const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");

router.use(authMiddleware);
router.use(adminOnly);

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "products");

const MIME_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = MIME_EXTENSIONS[file.mimetype] || "";
    const uniqueName = `${req.params.productId}-${Date.now()}-${crypto
      .randomBytes(6)
      .toString("hex")}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!MIME_EXTENSIONS[file.mimetype]) {
      return cb(new Error("Only JPEG, PNG, and WEBP images are allowed"));
    }
    cb(null, true);
  },
});

async function ensureProductExists(req, res, next) {
  try {
    const { productId } = req.params;
    const result = await pool.query("SELECT id FROM products WHERE id = $1", [
      productId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    next();
  } catch (err) {
    console.error("Check product exists error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

// GET /api/admin/products/:productId/images
router.get("/:productId/images", ensureProductExists, async (req, res) => {
  try {
    const { productId } = req.params;

    const result = await pool.query(
      `
      SELECT * FROM product_images
      WHERE product_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [productId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("List product images error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/products/:productId/images
router.post(
  "/:productId/images",
  ensureProductExists,
  (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    const { productId } = req.params;

    try {
      if (!req.file) {
        return res.status(400).json({ error: "image file is required" });
      }

      const activeCountResult = await pool.query(
        "SELECT COUNT(*) FROM product_images WHERE product_id = $1 AND is_active = true",
        [productId]
      );
      const isFirstActiveImage = Number(activeCountResult.rows[0].count) === 0;

      const sortOrderResult = await pool.query(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order FROM product_images WHERE product_id = $1",
        [productId]
      );
      const nextSortOrder = sortOrderResult.rows[0].next_sort_order;

      const baseUrl = process.env.BACKEND_PUBLIC_URL || "http://localhost:5000";
      const imageUrl = `${baseUrl}/uploads/products/${req.file.filename}`;

      const insertResult = await pool.query(
        `
        INSERT INTO product_images (product_id, image_url, sort_order, is_main, is_active)
        VALUES ($1, $2, $3, $4, true)
        RETURNING *
        `,
        [productId, imageUrl, nextSortOrder, isFirstActiveImage]
      );

      res.status(201).json(insertResult.rows[0]);
    } catch (err) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      console.error("Upload product image error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// PATCH /api/admin/products/:productId/images/:imageId/main
router.patch("/:productId/images/:imageId/main", async (req, res) => {
  const { productId, imageId } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const targetResult = await client.query(
      "SELECT id FROM product_images WHERE id = $1 AND product_id = $2 AND is_active = true",
      [imageId, productId]
    );

    if (targetResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ error: "Active image not found for this product" });
    }

    await client.query(
      "UPDATE product_images SET is_main = false WHERE product_id = $1",
      [productId]
    );

    const updateResult = await client.query(
      "UPDATE product_images SET is_main = true WHERE id = $1 AND product_id = $2 RETURNING *",
      [imageId, productId]
    );

    await client.query("COMMIT");
    res.json(updateResult.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Set main image error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// PATCH /api/admin/products/:productId/images/:imageId/deactivate
router.patch("/:productId/images/:imageId/deactivate", async (req, res) => {
  const { productId, imageId } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      "SELECT id, is_main FROM product_images WHERE id = $1 AND product_id = $2",
      [imageId, productId]
    );

    if (existingResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ error: "Image not found for this product" });
    }

    const wasMain = existingResult.rows[0].is_main;

    const deactivateResult = await client.query(
      "UPDATE product_images SET is_active = false, is_main = false WHERE id = $1 AND product_id = $2 RETURNING *",
      [imageId, productId]
    );

    if (wasMain) {
      const nextMainResult = await client.query(
        `
        SELECT id FROM product_images
        WHERE product_id = $1 AND is_active = true
        ORDER BY sort_order ASC, id ASC
        LIMIT 1
        `,
        [productId]
      );

      if (nextMainResult.rows.length > 0) {
        await client.query(
          "UPDATE product_images SET is_main = true WHERE id = $1",
          [nextMainResult.rows[0].id]
        );
      }
      // if no active images remain, all rows stay is_main = false;
      // the public product route falls back to products.image_url
    }

    await client.query("COMMIT");
    res.json(deactivateResult.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Deactivate product image error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

module.exports = router;
