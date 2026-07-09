const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware } = require("../middleware/auth.middleware");
const { getPublicBaseUrl } = require("../utils/publicUrl");

// Admin-only guard
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
}

router.use(authMiddleware);
router.use(adminOnly);

// TEST
router.get("/test", (req, res) => {
  res.json({ message: "Admin customization route working" });
});

// -------------------- COLORS --------------------

// GET /api/admin/customization/:productId/colors
router.get("/:productId/colors", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM customizable_product_colors
      WHERE product_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [req.params.productId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Get customization colors error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/customization/:productId/colors
router.post("/:productId/colors", async (req, res) => {
  try {
    const { color_name, color_hex, sort_order = 0 } = req.body;

    if (!color_name) {
      return res.status(400).json({ error: "color_name is required" });
    }

    const result = await pool.query(
      `
      INSERT INTO customizable_product_colors 
      (product_id, color_name, color_hex, sort_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [req.params.productId, color_name, color_hex || null, sort_order]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Add customization color error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/customization/colors/:id
router.patch("/colors/:id", async (req, res) => {
  try {
    const { color_name, color_hex, is_active, sort_order } = req.body;

    const result = await pool.query(
      `
      UPDATE customizable_product_colors
      SET 
        color_name = COALESCE($1, color_name),
        color_hex = COALESCE($2, color_hex),
        is_active = COALESCE($3, is_active),
        sort_order = COALESCE($4, sort_order)
      WHERE id = $5
      RETURNING *
      `,
      [color_name, color_hex, is_active, sort_order, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Color not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update customization color error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/customization/colors/:id
router.delete("/colors/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      DELETE FROM customizable_product_colors
      WHERE id = $1
      RETURNING *
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Color not found" });
    }

    res.json({ message: "Color deleted successfully" });
  } catch (err) {
    console.error("Delete customization color error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// -------------------- SIZES --------------------

// GET /api/admin/customization/:productId/sizes
router.get("/:productId/sizes", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM customizable_product_sizes
      WHERE product_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [req.params.productId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Get customization sizes error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/customization/:productId/sizes
router.post("/:productId/sizes", async (req, res) => {
  try {
    const { size_label, sort_order = 0 } = req.body;

    if (!size_label) {
      return res.status(400).json({ error: "size_label is required" });
    }

    const result = await pool.query(
      `
      INSERT INTO customizable_product_sizes 
      (product_id, size_label, sort_order)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [req.params.productId, size_label, sort_order]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Add customization size error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/customization/sizes/:id
router.patch("/sizes/:id", async (req, res) => {
  try {
    const { size_label, is_active, sort_order } = req.body;

    const result = await pool.query(
      `
      UPDATE customizable_product_sizes
      SET 
        size_label = COALESCE($1, size_label),
        is_active = COALESCE($2, is_active),
        sort_order = COALESCE($3, sort_order)
      WHERE id = $4
      RETURNING *
      `,
      [size_label, is_active, sort_order, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Size not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update customization size error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/customization/sizes/:id
router.delete("/sizes/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      DELETE FROM customizable_product_sizes
      WHERE id = $1
      RETURNING *
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Size not found" });
    }

    res.json({ message: "Size deleted successfully" });
  } catch (err) {
    console.error("Delete customization size error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// -------------------- DESIGN OPTIONS --------------------

// GET /api/admin/customization/:productId/options
router.get("/:productId/options", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM customization_options
      WHERE product_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [req.params.productId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Get customization options error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/customization/:productId/options
router.post("/:productId/options", async (req, res) => {
  try {
    const {
      option_label,
      option_type,
      description,
      extra_price = 0,
      sort_order = 0,
    } = req.body;

    if (!option_label || !option_type) {
      return res.status(400).json({
        error: "option_label and option_type are required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO customization_options
      (product_id, option_label, option_type, description, extra_price, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        req.params.productId,
        option_label,
        option_type,
        description || null,
        extra_price,
        sort_order,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Add customization option error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/customization/options/:id
router.patch("/options/:id", async (req, res) => {
  try {
    const {
      option_label,
      option_type,
      description,
      extra_price,
      is_active,
      sort_order,
    } = req.body;

    const result = await pool.query(
      `
      UPDATE customization_options
      SET 
        option_label = COALESCE($1, option_label),
        option_type = COALESCE($2, option_type),
        description = COALESCE($3, description),
        extra_price = COALESCE($4, extra_price),
        is_active = COALESCE($5, is_active),
        sort_order = COALESCE($6, sort_order)
      WHERE id = $7
      RETURNING *
      `,
      [
        option_label,
        option_type,
        description,
        extra_price,
        is_active,
        sort_order,
        req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Option not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update customization option error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/customization/options/:id
router.delete("/options/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      DELETE FROM customization_options
      WHERE id = $1
      RETURNING *
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Option not found" });
    }

    res.json({ message: "Option deleted successfully" });
  } catch (err) {
    console.error("Delete customization option error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// -------------------- EXAMPLES --------------------

// GET /api/admin/customization/:productId/examples
router.get("/:productId/examples", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM customization_examples
      WHERE product_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [req.params.productId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Get customization examples error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/customization/:productId/examples
router.post("/:productId/examples", async (req, res) => {
  try {
    const { image_url, caption, sort_order = 0 } = req.body;

    if (!image_url) {
      return res.status(400).json({ error: "image_url is required" });
    }

    const result = await pool.query(
      `
      INSERT INTO customization_examples
      (product_id, image_url, caption, sort_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [req.params.productId, image_url, caption || null, sort_order]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Add customization example error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/customization/examples/:id
router.patch("/examples/:id", async (req, res) => {
  try {
    const { image_url, caption, is_active, sort_order } = req.body;

    const result = await pool.query(
      `
      UPDATE customization_examples
      SET 
        image_url = COALESCE($1, image_url),
        caption = COALESCE($2, caption),
        is_active = COALESCE($3, is_active),
        sort_order = COALESCE($4, sort_order)
      WHERE id = $5
      RETURNING *
      `,
      [image_url, caption, is_active, sort_order, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Example not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update customization example error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/customization/examples/:id
router.delete("/examples/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      DELETE FROM customization_examples
      WHERE id = $1
      RETURNING *
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Example not found" });
    }

    res.json({ message: "Example deleted successfully" });
  } catch (err) {
    console.error("Delete customization example error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// -------------------- PRODUCT TOGGLE --------------------

// PATCH /api/admin/customization/product/:productId/toggle
router.patch("/product/:productId/toggle", async (req, res) => {
  try {
    const { is_customizable, customization_extra_price, customization_note } =
      req.body;

    const result = await pool.query(
      `
      UPDATE products
      SET 
        is_customizable = COALESCE($1, is_customizable),
        customization_extra_price = COALESCE($2, customization_extra_price),
        customization_note = COALESCE($3, customization_note)
      WHERE id = $4
      RETURNING 
        id, 
        name, 
        is_customizable, 
        customization_extra_price, 
        customization_note
      `,
      [
        is_customizable,
        customization_extra_price,
        customization_note,
        req.params.productId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Toggle product customization error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// -------------------- DESIGN COLLECTIONS --------------------

// GET /api/admin/customization/collections
router.get("/collections", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT dc.*, p.name AS product_name
      FROM design_collections dc
      JOIN products p ON p.id = dc.product_id
      ORDER BY dc.product_id ASC, dc.sort_order ASC, dc.id ASC
      `
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Get design collections error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/customization/collections
router.post("/collections", async (req, res) => {
  try {
    const { product_id, name, sort_order = 0 } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: "product_id is required" });
    }

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const result = await pool.query(
      `
      INSERT INTO design_collections
      (product_id, name, sort_order)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [product_id, name, sort_order]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Add design collection error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/customization/collections/:id
router.patch("/collections/:id", async (req, res) => {
  try {
    const { name, sort_order, is_active } = req.body;

    const result = await pool.query(
      `
      UPDATE design_collections
      SET
        name = COALESCE($1, name),
        sort_order = COALESCE($2, sort_order),
        is_active = COALESCE($3, is_active)
      WHERE id = $4
      RETURNING *
      `,
      [name, sort_order, is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Collection not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update design collection error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/customization/collections/:id
// Soft delete only — sets is_active = false, never hard-deletes.
router.delete("/collections/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      UPDATE design_collections
      SET is_active = false
      WHERE id = $1
      RETURNING *
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Collection not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Deactivate design collection error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// -------------------- COLLECTION DESIGNS --------------------

const DESIGN_UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "designs");

const DESIGN_MIME_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const designStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(DESIGN_UPLOAD_DIR, { recursive: true });
    cb(null, DESIGN_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = DESIGN_MIME_EXTENSIONS[file.mimetype] || "";
    const uniqueName = `design-${req.params.collectionId}-${Date.now()}-${crypto
      .randomBytes(6)
      .toString("hex")}${ext}`;
    cb(null, uniqueName);
  },
});

const uploadDesignImage = multer({
  storage: designStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!DESIGN_MIME_EXTENSIONS[file.mimetype]) {
      return cb(new Error("Only JPEG, PNG, and WEBP images are allowed"));
    }
    cb(null, true);
  },
});

async function ensureCollectionExists(req, res, next) {
  try {
    const { collectionId } = req.params;
    const result = await pool.query(
      "SELECT id FROM design_collections WHERE id = $1",
      [collectionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Collection not found" });
    }

    next();
  } catch (err) {
    console.error("Check collection exists error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

// GET /api/admin/customization/collections/:collectionId/designs
router.get(
  "/collections/:collectionId/designs",
  ensureCollectionExists,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT *
        FROM collection_designs
        WHERE collection_id = $1
        ORDER BY sort_order ASC, id ASC
        `,
        [req.params.collectionId]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("Get collection designs error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// POST /api/admin/customization/collections/:collectionId/designs
router.post(
  "/collections/:collectionId/designs",
  ensureCollectionExists,
  (req, res, next) => {
    uploadDesignImage.single("image")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "image file is required" });
      }

      const { name, sort_order = 0 } = req.body;

      if (!name) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: "name is required" });
      }

      const baseUrl = getPublicBaseUrl(req);
      const imageUrl = `${baseUrl}/uploads/designs/${req.file.filename}`;

      const result = await pool.query(
        `
        INSERT INTO collection_designs
        (collection_id, name, image_url, sort_order)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [req.params.collectionId, name, imageUrl, sort_order]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      console.error("Add collection design error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// PATCH /api/admin/customization/designs/:id
router.patch("/designs/:id", async (req, res) => {
  try {
    const { name, sort_order, is_active } = req.body;

    const result = await pool.query(
      `
      UPDATE collection_designs
      SET
        name = COALESCE($1, name),
        sort_order = COALESCE($2, sort_order),
        is_active = COALESCE($3, is_active)
      WHERE id = $4
      RETURNING *
      `,
      [name, sort_order, is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Design not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update collection design error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/customization/designs/:id
// Soft delete only — sets is_active = false. Does not remove the uploaded file.
router.delete("/designs/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      UPDATE collection_designs
      SET is_active = false
      WHERE id = $1
      RETURNING *
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Design not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Deactivate collection design error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;