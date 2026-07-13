const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");
const { getPublicBaseUrl } = require("../utils/publicUrl");
const { sanitizeIdForFilename } = require("../utils/safeFilename");

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
    // productId is already confirmed numeric by ensureProductExists before
    // this ever runs, but sanitizeIdForFilename is applied defensively
    // anyway — see backend/src/utils/safeFilename.js.
    const uniqueName = `${sanitizeIdForFilename(req.params.productId)}-${Date.now()}-${crypto
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

      const rawColorId = req.body.color_id;
      let colorId = null;

      if (rawColorId !== null && rawColorId !== undefined && rawColorId !== "") {
        const parsedColorId = Number(rawColorId);

        if (!Number.isFinite(parsedColorId)) {
          fs.unlink(req.file.path, () => {});
          return res.status(400).json({ error: "Invalid color_id" });
        }

        colorId = parsedColorId;
      }

      if (colorId) {
        const colorCheck = await pool.query(
          "SELECT id, product_id, is_active FROM customizable_product_colors WHERE id = $1",
          [colorId]
        );

        if (colorCheck.rows.length === 0) {
          fs.unlink(req.file.path, () => {});
          return res.status(400).json({ error: "Invalid color_id" });
        }

        const color = colorCheck.rows[0];

        if (Number(color.product_id) !== Number(productId)) {
          fs.unlink(req.file.path, () => {});
          return res
            .status(400)
            .json({ error: "Selected color does not belong to this product" });
        }

        if (!color.is_active) {
          fs.unlink(req.file.path, () => {});
          return res.status(400).json({ error: "Selected color is not active" });
        }
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

      const baseUrl = getPublicBaseUrl(req);
      const imageUrl = `${baseUrl}/uploads/products/${req.file.filename}`;

      const insertResult = await pool.query(
        `
        INSERT INTO product_images (product_id, image_url, sort_order, is_main, is_active, color_id)
        VALUES ($1, $2, $3, $4, true, $5)
        RETURNING *
        `,
        [productId, imageUrl, nextSortOrder, isFirstActiveImage, colorId]
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

// -------------------- VARIANT INVENTORY (Task K1) --------------------
// Foundation only: GENERAL (products.stock_quantity, existing behavior)
// vs VARIANT (per color+size stock in product_inventory_variants).
// No customer-facing or Cart/checkout code reads any of this yet.

// Active colors/sizes for a product, in the same shape/order already used
// by the public customization route (id, name/label, sort_order).
async function getActiveColorsAndSizes(productId) {
  const [colorsResult, sizesResult] = await Promise.all([
    pool.query(
      `
      SELECT id, color_name, color_hex, sort_order
      FROM customizable_product_colors
      WHERE product_id = $1 AND is_active = true
      ORDER BY sort_order ASC, id ASC
      `,
      [productId]
    ),
    pool.query(
      `
      SELECT id, size_label, sort_order
      FROM customizable_product_sizes
      WHERE product_id = $1 AND is_active = true
      ORDER BY sort_order ASC, id ASC
      `,
      [productId]
    ),
  ]);

  return { colors: colorsResult.rows, sizes: sizesResult.rows };
}

// Every combination a VARIANT product is currently expected to have a
// stock row for: colors × sizes when the product has active colors,
// otherwise sizes alone (color_id null on every combination).
function computeExpectedCombinations(colors, sizes) {
  if (colors.length === 0) {
    return sizes.map((size) => ({
      color_id: null,
      size_id: size.id,
      color_name: null,
      size_label: size.size_label,
    }));
  }

  const combinations = [];
  for (const color of colors) {
    for (const size of sizes) {
      combinations.push({
        color_id: color.id,
        size_id: size.id,
        color_name: color.color_name,
        size_label: size.size_label,
      });
    }
  }
  return combinations;
}

function combinationKey(colorId, sizeId) {
  return `${colorId === null || colorId === undefined ? "null" : colorId}:${sizeId}`;
}

// GET /api/admin/products/:productId/inventory
router.get("/:productId/inventory", ensureProductExists, async (req, res) => {
  try {
    const { productId } = req.params;

    const productResult = await pool.query(
      "SELECT id, stock_quantity, inventory_mode FROM products WHERE id = $1",
      [productId]
    );
    const product = productResult.rows[0];

    const { colors, sizes } = await getActiveColorsAndSizes(productId);

    // All stored variant rows, including ones whose color/size has since
    // gone inactive — they stay visible/stored, just excluded from the
    // completeness count below.
    const variantsResult = await pool.query(
      `
      SELECT id, color_id, size_id, stock_quantity, created_at, updated_at
      FROM product_inventory_variants
      WHERE product_id = $1
      ORDER BY color_id ASC NULLS FIRST, size_id ASC
      `,
      [productId]
    );

    const expectedCombinations = computeExpectedCombinations(colors, sizes);
    const configuredKeys = new Set(
      variantsResult.rows.map((v) => combinationKey(v.color_id, v.size_id))
    );

    const missingCombinations = expectedCombinations.filter(
      (combo) => !configuredKeys.has(combinationKey(combo.color_id, combo.size_id))
    );

    const configuredCombinations = expectedCombinations.length - missingCombinations.length;
    const isComplete =
      expectedCombinations.length > 0 && missingCombinations.length === 0;

    res.json({
      product_id: Number(productId),
      inventory_mode: product.inventory_mode,
      general_stock_quantity: product.stock_quantity,
      colors,
      sizes,
      variants: variantsResult.rows,
      expected_combinations: expectedCombinations.length,
      configured_combinations: configuredCombinations,
      is_complete: isComplete,
      missing_combinations: missingCombinations,
    });
  } catch (err) {
    console.error("Get product inventory error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/admin/products/:productId/inventory/variants
// Batch upsert. Every row is fully validated before anything is written —
// one bad row rejects the whole batch, nothing partial is ever saved.
router.put(
  "/:productId/inventory/variants",
  ensureProductExists,
  async (req, res) => {
    const { productId } = req.params;
    const { variants } = req.body;

    if (!Array.isArray(variants)) {
      return res.status(400).json({ error: "variants must be an array." });
    }

    try {
      const { colors, sizes } = await getActiveColorsAndSizes(productId);
      const hasActiveColors = colors.length > 0;
      const activeColorIds = new Set(colors.map((c) => c.id));
      const activeSizeIds = new Set(sizes.map((s) => s.id));

      // Rows referencing an id that exists but belongs to another product,
      // or exists but is inactive, get the same two-tier distinction the
      // product-image color validation above already uses.
      const allColorsResult = await pool.query(
        "SELECT id, product_id, is_active FROM customizable_product_colors WHERE id = ANY($1::int[])",
        [variants.map((v) => v.color_id).filter((id) => id !== null && id !== undefined)]
      );
      const colorById = new Map(allColorsResult.rows.map((c) => [c.id, c]));

      const allSizesResult = await pool.query(
        "SELECT id, product_id, is_active FROM customizable_product_sizes WHERE id = ANY($1::int[])",
        [variants.map((v) => v.size_id).filter((id) => id !== null && id !== undefined)]
      );
      const sizeById = new Map(allSizesResult.rows.map((s) => [s.id, s]));

      const seenKeys = new Set();
      const normalizedRows = [];

      for (const row of variants) {
        const rawColorId = row.color_id;
        const rawSizeId = row.size_id;
        const rawStock = row.stock_quantity;

        const colorProvided = rawColorId !== null && rawColorId !== undefined;

        if (hasActiveColors && !colorProvided) {
          return res
            .status(400)
            .json({ error: "color_id is required for this product." });
        }

        if (!hasActiveColors && colorProvided) {
          return res.status(400).json({
            error: "This product has no active colors; color_id must be omitted or null.",
          });
        }

        let colorId = null;
        if (colorProvided) {
          colorId = Number(rawColorId);
          const color = colorById.get(colorId);

          if (!Number.isInteger(colorId) || !color) {
            return res.status(400).json({ error: "Invalid color_id." });
          }
          if (Number(color.product_id) !== Number(productId)) {
            return res
              .status(400)
              .json({ error: "Selected color does not belong to this product." });
          }
          if (!color.is_active || !activeColorIds.has(colorId)) {
            return res.status(400).json({ error: "Selected color is not active." });
          }
        }

        const sizeId = Number(rawSizeId);
        const size = sizeById.get(sizeId);

        if (rawSizeId === null || rawSizeId === undefined || !Number.isInteger(sizeId) || !size) {
          return res.status(400).json({ error: "Invalid size_id." });
        }
        if (Number(size.product_id) !== Number(productId)) {
          return res
            .status(400)
            .json({ error: "Selected size does not belong to this product." });
        }
        if (!size.is_active || !activeSizeIds.has(sizeId)) {
          return res.status(400).json({ error: "Selected size is not active." });
        }

        if (
          typeof rawStock !== "number" ||
          !Number.isInteger(rawStock) ||
          rawStock < 0
        ) {
          return res
            .status(400)
            .json({ error: "Stock quantity must be a nonnegative integer." });
        }

        const key = combinationKey(colorId, sizeId);
        if (seenKeys.has(key)) {
          return res.status(400).json({
            error: "Duplicate color/size combination in request.",
          });
        }
        seenKeys.add(key);

        normalizedRows.push({ colorId, sizeId, stockQuantity: rawStock });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Same product-row lock the mode-switch PATCH takes below, so the
        // two endpoints actually serialize per product: a mode switch can
        // no longer inspect the matrix while this save is still mid-write,
        // and two saves for the same product can't interleave either.
        // Different products still update independently (the lock is on
        // that product's own row only).
        await client.query("SELECT id FROM products WHERE id = $1 FOR UPDATE", [
          productId,
        ]);

        for (const { colorId, sizeId, stockQuantity } of normalizedRows) {
          if (colorId !== null) {
            await client.query(
              `
              INSERT INTO product_inventory_variants (product_id, color_id, size_id, stock_quantity, updated_at)
              VALUES ($1, $2, $3, $4, now())
              ON CONFLICT (product_id, color_id, size_id) WHERE color_id IS NOT NULL
              DO UPDATE SET stock_quantity = EXCLUDED.stock_quantity, updated_at = now()
              `,
              [productId, colorId, sizeId, stockQuantity]
            );
          } else {
            await client.query(
              `
              INSERT INTO product_inventory_variants (product_id, color_id, size_id, stock_quantity, updated_at)
              VALUES ($1, NULL, $2, $3, now())
              ON CONFLICT (product_id, size_id) WHERE color_id IS NULL
              DO UPDATE SET stock_quantity = EXCLUDED.stock_quantity, updated_at = now()
              `,
              [productId, sizeId, stockQuantity]
            );
          }
        }

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }

      const finalResult = await pool.query(
        `
        SELECT id, color_id, size_id, stock_quantity, created_at, updated_at
        FROM product_inventory_variants
        WHERE product_id = $1
        ORDER BY color_id ASC NULLS FIRST, size_id ASC
        `,
        [productId]
      );

      res.json({ variants: finalResult.rows });
    } catch (err) {
      console.error("Batch upsert inventory variants error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// PATCH /api/admin/products/:productId/inventory/mode
router.patch(
  "/:productId/inventory/mode",
  ensureProductExists,
  async (req, res) => {
    const { productId } = req.params;
    const { inventory_mode } = req.body;

    if (inventory_mode !== "GENERAL" && inventory_mode !== "VARIANT") {
      return res
        .status(400)
        .json({ error: "inventory_mode must be GENERAL or VARIANT." });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Same product-row lock the variant-upsert PUT above takes. Both
      // endpoints lock this exact row first, so they serialize per product:
      // this completeness check can never run while a variant save for the
      // same product is still mid-write, and two mode switches for the same
      // product can't race each other either.
      await client.query("SELECT id FROM products WHERE id = $1 FOR UPDATE", [
        productId,
      ]);

      if (inventory_mode === "GENERAL") {
        const result = await client.query(
          "UPDATE products SET inventory_mode = 'GENERAL' WHERE id = $1 RETURNING id, inventory_mode, stock_quantity",
          [productId]
        );
        await client.query("COMMIT");
        return res.json(result.rows[0]);
      }

      // Switching to VARIANT: every active color×size combination (or
      // size-only, if the product has no active colors) must already have
      // a stored, valid stock row.
      const { colors, sizes } = await getActiveColorsAndSizes(productId);

      if (sizes.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "Variant inventory requires configured sizes." });
      }

      const expectedCombinations = computeExpectedCombinations(colors, sizes);

      const variantsResult = await client.query(
        "SELECT color_id, size_id FROM product_inventory_variants WHERE product_id = $1",
        [productId]
      );
      const configuredKeys = new Set(
        variantsResult.rows.map((v) => combinationKey(v.color_id, v.size_id))
      );

      const missingCombinations = expectedCombinations.filter(
        (combo) => !configuredKeys.has(combinationKey(combo.color_id, combo.size_id))
      );

      if (missingCombinations.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error:
            "Configure stock for every active color and size before enabling variant inventory.",
          missing_combinations: missingCombinations,
        });
      }

      const result = await client.query(
        "UPDATE products SET inventory_mode = 'VARIANT' WHERE id = $1 RETURNING id, inventory_mode, stock_quantity",
        [productId]
      );

      await client.query("COMMIT");
      res.json(result.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Change inventory mode error:", err);
      res.status(500).json({ error: "Server error" });
    } finally {
      client.release();
    }
  }
);

// PATCH /api/admin/products/:productId/sizing
// Task L1: MULTI_SIZE (real selectable sizes) vs STANDARD (one fixed
// admin-defined label, no size rows at all).
router.patch(
  "/:productId/sizing",
  ensureProductExists,
  async (req, res) => {
    const { productId } = req.params;
    const { sizing_mode, standard_size_label } = req.body;

    if (sizing_mode !== "MULTI_SIZE" && sizing_mode !== "STANDARD") {
      return res
        .status(400)
        .json({ error: "sizing_mode must be MULTI_SIZE or STANDARD." });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Same product-row lock the inventory-mode PATCH above takes, so a
      // concurrent size add/reactivate or inventory-mode switch for this
      // exact product can't race this check.
      await client.query("SELECT id FROM products WHERE id = $1 FOR UPDATE", [
        productId,
      ]);

      if (sizing_mode === "MULTI_SIZE") {
        // Task L1 design choice: CLEAR standard_size_label on switch to
        // MULTI_SIZE rather than silently preserve it. A MULTI_SIZE
        // product never displays this field, and keeping a stale value
        // around risks it resurfacing confusingly if the product is later
        // switched back to STANDARD without the owner re-entering it.
        // Switching to MULTI_SIZE itself is never blocked — the product
        // simply isn't customer-purchasable until an active size exists,
        // which is enforced at Cart/checkout time, not here.
        const result = await client.query(
          `UPDATE products
           SET sizing_mode = 'MULTI_SIZE', standard_size_label = NULL
           WHERE id = $1
           RETURNING id, sizing_mode, standard_size_label, inventory_mode`,
          [productId]
        );
        await client.query("COMMIT");
        return res.json(result.rows[0]);
      }

      // Switching to STANDARD.
      const trimmedLabel =
        typeof standard_size_label === "string" ? standard_size_label.trim() : "";

      if (!trimmedLabel) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "standard_size_label is required." });
      }

      const productResult = await client.query(
        "SELECT inventory_mode FROM products WHERE id = $1",
        [productId]
      );

      if (productResult.rows[0].inventory_mode === "VARIANT") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Standard-size products must use General inventory.",
        });
      }

      const activeSizeCountResult = await client.query(
        "SELECT COUNT(*) FROM customizable_product_sizes WHERE product_id = $1 AND is_active = true",
        [productId]
      );

      if (Number(activeSizeCountResult.rows[0].count) > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Deactivate all product sizes before switching to Standard sizing.",
        });
      }

      const result = await client.query(
        `UPDATE products
         SET sizing_mode = 'STANDARD', standard_size_label = $1
         WHERE id = $2
         RETURNING id, sizing_mode, standard_size_label, inventory_mode`,
        [trimmedLabel, productId]
      );

      await client.query("COMMIT");
      res.json(result.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Change sizing mode error:", err);
      res.status(500).json({ error: "Server error" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
