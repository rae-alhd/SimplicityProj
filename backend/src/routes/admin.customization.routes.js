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

// Task I1: shared query fragment so every place that returns a design also
// returns its assigned placement/customization option label. LEFT JOIN so a
// legacy design with customization_option_id = null still returns (with
// customization_option_name: null) instead of being dropped or crashing.
const DESIGN_SELECT_WITH_OPTION = `
  SELECT
    cd.*,
    co.option_label AS customization_option_name
  FROM collection_designs cd
  LEFT JOIN customization_options co ON co.id = cd.customization_option_id
`;

// Resolves the product_id a design (or a to-be-created design under a given
// collection) belongs to, via collection_designs -> design_collections.
async function getCollectionProductId(collectionId) {
  const result = await pool.query(
    "SELECT product_id FROM design_collections WHERE id = $1",
    [collectionId]
  );
  return result.rows[0]?.product_id ?? null;
}

// Task I1: validates a submitted customization_option_id for a design.
// - undefined (field omitted entirely) -> "leave unchanged" for PATCH, or
//   "no placement" for POST; caller distinguishes via hasOwnProperty.
// - null / "" -> explicitly clear the placement.
// - otherwise -> must be an integer referencing an ACTIVE option belonging
//   to the SAME product as the design's collection. Product A's option can
//   never be attached to Product B's design.
// Returns { ok: true, value: number|null } or { ok: false, error }.
async function resolveDesignOptionId(productId, rawValue) {
  if (rawValue === null || rawValue === "" || rawValue === undefined) {
    return { ok: true, value: null };
  }

  const optionId = Number(rawValue);
  if (!Number.isInteger(optionId)) {
    return {
      ok: false,
      error: "customization_option_id must be an integer or null",
    };
  }

  const optionResult = await pool.query(
    "SELECT id FROM customization_options WHERE id = $1 AND is_active = true AND product_id = $2",
    [optionId, productId]
  );

  if (optionResult.rows.length === 0) {
    return {
      ok: false,
      error:
        "customization_option_id must reference an active option belonging to this design's product",
    };
  }

  return { ok: true, value: optionId };
}

// GET /api/admin/customization/collections/:collectionId/designs
router.get(
  "/collections/:collectionId/designs",
  ensureCollectionExists,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        ${DESIGN_SELECT_WITH_OPTION}
        WHERE cd.collection_id = $1
        ORDER BY cd.sort_order ASC, cd.id ASC
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

      const { name, sort_order = 0, customization_option_id } = req.body;

      if (!name) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: "name is required" });
      }

      const productId = await getCollectionProductId(req.params.collectionId);

      const optionResolution = await resolveDesignOptionId(
        productId,
        customization_option_id
      );

      if (!optionResolution.ok) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: optionResolution.error });
      }

      const baseUrl = getPublicBaseUrl(req);
      const imageUrl = `${baseUrl}/uploads/designs/${req.file.filename}`;

      const insertResult = await pool.query(
        `
        INSERT INTO collection_designs
        (collection_id, name, image_url, sort_order, customization_option_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        `,
        [
          req.params.collectionId,
          name,
          imageUrl,
          sort_order,
          optionResolution.value,
        ]
      );

      const result = await pool.query(
        `${DESIGN_SELECT_WITH_OPTION} WHERE cd.id = $1`,
        [insertResult.rows[0].id]
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

    // customization_option_id uses hasOwnProperty (not just truthiness) so
    // the owner can explicitly clear a design's placement back to null —
    // COALESCE-against-undefined (like the other fields above) can't tell
    // "field omitted" apart from "field explicitly set to null".
    const hasOptionField = Object.prototype.hasOwnProperty.call(
      req.body,
      "customization_option_id"
    );

    let nextOptionId;

    if (hasOptionField) {
      const designProductResult = await pool.query(
        `
        SELECT dc.product_id
        FROM collection_designs cd
        JOIN design_collections dc ON dc.id = cd.collection_id
        WHERE cd.id = $1
        `,
        [req.params.id]
      );

      if (designProductResult.rows.length === 0) {
        return res.status(404).json({ error: "Design not found" });
      }

      const optionResolution = await resolveDesignOptionId(
        designProductResult.rows[0].product_id,
        req.body.customization_option_id
      );

      if (!optionResolution.ok) {
        return res.status(400).json({ error: optionResolution.error });
      }

      nextOptionId = optionResolution.value;
    }

    const updateResult = await pool.query(
      `
      UPDATE collection_designs
      SET
        name = COALESCE($1, name),
        sort_order = COALESCE($2, sort_order),
        is_active = COALESCE($3, is_active),
        customization_option_id = CASE
          WHEN $5 THEN $4
          ELSE customization_option_id
        END
      WHERE id = $6
      RETURNING id
      `,
      [name, sort_order, is_active, nextOptionId, hasOptionField, req.params.id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: "Design not found" });
    }

    const result = await pool.query(
      `${DESIGN_SELECT_WITH_OPTION} WHERE cd.id = $1`,
      [updateResult.rows[0].id]
    );

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

// -------------------- DESIGN/COLOR COMPATIBILITY (VARIANTS) --------------------
// Design Studio Task E1: manage collection_design_variants (which colors a
// design is allowed on) and collection_design_variant_sizes (optional size
// restrictions per variant). Preview-image endpoints are a later task.

// Resolves collection -> design -> product_id, validating that the design
// belongs to the given collection along the way. Returns null if there is
// no design with that id inside that collection.
async function getCollectionDesignProduct(collectionId, designId) {
  const result = await pool.query(
    `
    SELECT
      cd.id AS design_id,
      cd.collection_id,
      dc.product_id
    FROM collection_designs cd
    JOIN design_collections dc ON dc.id = cd.collection_id
    WHERE cd.id = $1 AND cd.collection_id = $2
    `,
    [designId, collectionId]
  );

  return result.rows[0] || null;
}

// Resolves a variant's product via variant -> design -> collection -> product.
// Returns null if the variant doesn't exist. Accepts an optional pg client
// so callers running inside a transaction reuse the same connection.
async function getVariantProduct(variantId, queryable = pool) {
  const result = await queryable.query(
    `
    SELECT
      cdv.id AS variant_id,
      cdv.design_id,
      dc.product_id
    FROM collection_design_variants cdv
    JOIN collection_designs cd ON cd.id = cdv.design_id
    JOIN design_collections dc ON dc.id = cd.collection_id
    WHERE cdv.id = $1
    `,
    [variantId]
  );

  return result.rows[0] || null;
}

function withColorInfo(variantRow, colorRow) {
  return {
    ...variantRow,
    color_name: colorRow.color_name,
    color_hex: colorRow.color_hex,
  };
}

// GET /api/admin/customization/collections/:collectionId/designs/:designId/variants
router.get(
  "/collections/:collectionId/designs/:designId/variants",
  async (req, res) => {
    try {
      const { collectionId, designId } = req.params;

      const collectionCheck = await pool.query(
        "SELECT id FROM design_collections WHERE id = $1",
        [collectionId]
      );
      if (collectionCheck.rows.length === 0) {
        return res.status(404).json({ error: "Collection not found" });
      }

      const designProduct = await getCollectionDesignProduct(
        collectionId,
        designId
      );
      if (!designProduct) {
        return res
          .status(404)
          .json({ error: "Design not found in this collection" });
      }

      // Intentionally not filtering by is_active — inactive rows must be
      // returned too, so the admin can reactivate them.
      const variantsResult = await pool.query(
        `
        SELECT
          cdv.id,
          cdv.design_id,
          cdv.color_id,
          c.color_name,
          c.color_hex,
          cdv.is_active,
          cdv.sort_order
        FROM collection_design_variants cdv
        JOIN customizable_product_colors c ON c.id = cdv.color_id
        WHERE cdv.design_id = $1
        ORDER BY cdv.sort_order ASC, cdv.id ASC
        `,
        [designId]
      );

      const variantIds = variantsResult.rows.map((v) => v.id);

      const sizesResult = await pool.query(
        `
        SELECT
          cdvs.variant_id,
          s.id,
          s.size_label,
          s.sort_order
        FROM collection_design_variant_sizes cdvs
        JOIN customizable_product_sizes s ON s.id = cdvs.size_id
        WHERE cdvs.variant_id = ANY($1::int[])
        ORDER BY cdvs.variant_id ASC, s.sort_order ASC, s.id ASC
        `,
        [variantIds]
      );

      const sizesByVariant = {};
      for (const row of sizesResult.rows) {
        if (!sizesByVariant[row.variant_id]) {
          sizesByVariant[row.variant_id] = [];
        }
        sizesByVariant[row.variant_id].push({
          id: row.id,
          size_label: row.size_label,
          sort_order: row.sort_order,
        });
      }

      const variants = variantsResult.rows.map((v) => ({
        id: v.id,
        design_id: v.design_id,
        color_id: v.color_id,
        color_name: v.color_name,
        color_hex: v.color_hex,
        is_active: v.is_active,
        sort_order: v.sort_order,
        size_restrictions: sizesByVariant[v.id] || [],
      }));

      res.json(variants);
    } catch (err) {
      console.error("Get design variants error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// POST /api/admin/customization/collections/:collectionId/designs/:designId/variants
router.post(
  "/collections/:collectionId/designs/:designId/variants",
  async (req, res) => {
    try {
      const { collectionId, designId } = req.params;
      const { color_id, sort_order } = req.body;

      const collectionCheck = await pool.query(
        "SELECT id FROM design_collections WHERE id = $1",
        [collectionId]
      );
      if (collectionCheck.rows.length === 0) {
        return res.status(404).json({ error: "Collection not found" });
      }

      const designProduct = await getCollectionDesignProduct(
        collectionId,
        designId
      );
      if (!designProduct) {
        return res
          .status(404)
          .json({ error: "Design not found in this collection" });
      }

      const parsedColorId = Number(color_id);
      if (!Number.isInteger(parsedColorId) || parsedColorId <= 0) {
        return res.status(400).json({ error: "A valid color_id is required" });
      }

      let parsedSortOrder = 0;
      if (sort_order !== undefined) {
        parsedSortOrder = Number(sort_order);
        if (!Number.isInteger(parsedSortOrder)) {
          return res
            .status(400)
            .json({ error: "sort_order must be an integer" });
        }
      }

      // Never trust the supplied color_id alone — it must exist AND belong
      // to the same product the design's collection belongs to.
      const colorCheck = await pool.query(
        "SELECT id, product_id, color_name, color_hex FROM customizable_product_colors WHERE id = $1",
        [parsedColorId]
      );
      if (colorCheck.rows.length === 0) {
        return res.status(400).json({ error: "Color not found" });
      }

      const color = colorCheck.rows[0];
      if (Number(color.product_id) !== Number(designProduct.product_id)) {
        return res.status(400).json({
          error: "Selected color does not belong to this design's product",
        });
      }

      const existing = await pool.query(
        "SELECT * FROM collection_design_variants WHERE design_id = $1 AND color_id = $2",
        [designId, parsedColorId]
      );

      if (existing.rows.length > 0) {
        const variant = existing.rows[0];

        if (variant.is_active) {
          return res.status(409).json({
            error: "This design is already active for the selected color",
          });
        }

        const reactivated = await pool.query(
          `
          UPDATE collection_design_variants
          SET is_active = true, sort_order = $1
          WHERE id = $2
          RETURNING *
          `,
          [parsedSortOrder, variant.id]
        );

        return res.json(withColorInfo(reactivated.rows[0], color));
      }

      const inserted = await pool.query(
        `
        INSERT INTO collection_design_variants (design_id, color_id, sort_order)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [designId, parsedColorId, parsedSortOrder]
      );

      res.status(201).json(withColorInfo(inserted.rows[0], color));
    } catch (err) {
      // Defensive backstop against a race between the existence check above
      // and the insert (two concurrent requests for the same design+color).
      if (err.code === "23505") {
        return res.status(409).json({
          error: "This design is already active for the selected color",
        });
      }
      console.error("Add design variant error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// PATCH /api/admin/customization/variants/:variantId
router.patch("/variants/:variantId", async (req, res) => {
  try {
    const { variantId } = req.params;
    const { is_active, sort_order } = req.body;

    if (is_active === undefined && sort_order === undefined) {
      return res.status(400).json({
        error: "At least one of is_active or sort_order is required",
      });
    }

    if (is_active !== undefined && typeof is_active !== "boolean") {
      return res.status(400).json({ error: "is_active must be a boolean" });
    }

    let parsedSortOrder;
    if (sort_order !== undefined) {
      parsedSortOrder = Number(sort_order);
      if (!Number.isInteger(parsedSortOrder)) {
        return res
          .status(400)
          .json({ error: "sort_order must be an integer" });
      }
    }

    // design_id/color_id are intentionally never read from the body and
    // never touched by this UPDATE — this endpoint cannot change them.
    // Deactivating here only flips is_active; collection_design_variant_sizes
    // rows for this variant are untouched (no hard delete anywhere).
    const result = await pool.query(
      `
      UPDATE collection_design_variants
      SET
        is_active = COALESCE($1, is_active),
        sort_order = COALESCE($2, sort_order)
      WHERE id = $3
      RETURNING *
      `,
      [is_active, parsedSortOrder, variantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Variant not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update design variant error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/admin/customization/variants/:variantId/sizes
router.put("/variants/:variantId/sizes", async (req, res) => {
  const { variantId } = req.params;
  const { size_ids } = req.body;

  if (!Array.isArray(size_ids)) {
    return res.status(400).json({ error: "size_ids must be an array" });
  }

  // Duplicates are normalized (deduped) rather than rejected — this keeps
  // the endpoint idempotent for an admin UI that re-submits the full
  // selected-size set on every save, rather than forcing the caller to
  // dedupe client-side first.
  const uniqueSizeIds = [...new Set(size_ids.map((id) => Number(id)))];

  for (const id of uniqueSizeIds) {
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "size_ids must contain only valid positive integers",
      });
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const variant = await getVariantProduct(variantId, client);
    if (!variant) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Variant not found" });
    }

    // Never trust the supplied size_ids alone — every one must exist, be
    // active, and belong to the same product as the variant's design.
    if (uniqueSizeIds.length > 0) {
      const sizesResult = await client.query(
        `
        SELECT id
        FROM customizable_product_sizes
        WHERE id = ANY($1::int[]) AND product_id = $2 AND is_active = true
        `,
        [uniqueSizeIds, variant.product_id]
      );

      const validIds = new Set(sizesResult.rows.map((r) => r.id));
      const invalidIds = uniqueSizeIds.filter((id) => !validIds.has(id));

      if (invalidIds.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `The following size ids are invalid, inactive, or belong to a different product: ${invalidIds.join(", ")}`,
        });
      }
    }

    await client.query(
      "DELETE FROM collection_design_variant_sizes WHERE variant_id = $1",
      [variantId]
    );

    if (uniqueSizeIds.length > 0) {
      const valuePlaceholders = uniqueSizeIds
        .map((_, i) => `($1, $${i + 2})`)
        .join(", ");

      await client.query(
        `INSERT INTO collection_design_variant_sizes (variant_id, size_id) VALUES ${valuePlaceholders}`,
        [variantId, ...uniqueSizeIds]
      );
    }

    // Empty array (or an all-sizes selection normalized down to zero
    // restriction rows never happens here, since we only ever insert what
    // was validated) means: zero rows -> all of the product's sizes allowed.
    const finalResult = await client.query(
      `
      SELECT s.id, s.size_label, s.sort_order
      FROM collection_design_variant_sizes cdvs
      JOIN customizable_product_sizes s ON s.id = cdvs.size_id
      WHERE cdvs.variant_id = $1
      ORDER BY s.sort_order ASC, s.id ASC
      `,
      [variantId]
    );

    await client.query("COMMIT");

    res.json(finalResult.rows);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update variant size restrictions error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// -------------------- DESIGN/COLOR PREVIEW IMAGES (Task E2) --------------------
// Multiple ordered preview photos per collection_design_variants row (e.g.
// "Yemen on Black" gets its own front/back/close-up gallery, separate from
// "Yemen on White"). Mirrors admin.products.routes.js's product-gallery
// endpoints (same multer config shape, same main-image/deactivate
// transaction pattern) and the design-image upload already in this file —
// no new image-management approach is introduced here.

const PREVIEW_UPLOAD_DIR = path.join(
  __dirname,
  "..",
  "..",
  "uploads",
  "design-previews"
);

const PREVIEW_MIME_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const previewStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(PREVIEW_UPLOAD_DIR, { recursive: true });
    cb(null, PREVIEW_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = PREVIEW_MIME_EXTENSIONS[file.mimetype] || "";
    const uniqueName = `preview-${req.params.variantId}-${Date.now()}-${crypto
      .randomBytes(6)
      .toString("hex")}${ext}`;
    cb(null, uniqueName);
  },
});

const uploadPreviewImages = multer({
  storage: previewStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!PREVIEW_MIME_EXTENSIONS[file.mimetype]) {
      return cb(new Error("Only JPEG, PNG, and WEBP images are allowed"));
    }
    cb(null, true);
  },
});

async function ensureVariantExists(req, res, next) {
  try {
    const { variantId } = req.params;
    const result = await pool.query(
      "SELECT id FROM collection_design_variants WHERE id = $1",
      [variantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Variant not found" });
    }

    next();
  } catch (err) {
    console.error("Check variant exists error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

// GET /api/admin/customization/variants/:variantId/preview-images
router.get(
  "/variants/:variantId/preview-images",
  ensureVariantExists,
  async (req, res) => {
    try {
      const { variantId } = req.params;

      // Intentionally not filtering by is_active — inactive images are
      // still returned so the owner can manage/reactivate them.
      const result = await pool.query(
        `
        SELECT id, variant_id, image_url, sort_order, is_main, is_active, created_at
        FROM collection_design_preview_images
        WHERE variant_id = $1
        ORDER BY is_main DESC, sort_order ASC, id ASC
        `,
        [variantId]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("Get variant preview images error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// POST /api/admin/customization/variants/:variantId/preview-images
router.post(
  "/variants/:variantId/preview-images",
  ensureVariantExists,
  (req, res, next) => {
    uploadPreviewImages.array("images")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    const { variantId } = req.params;
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ error: "At least one image file is required" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const activeCountResult = await client.query(
        "SELECT COUNT(*) FROM collection_design_preview_images WHERE variant_id = $1 AND is_active = true",
        [variantId]
      );
      const isFirstActiveImage = Number(activeCountResult.rows[0].count) === 0;

      const sortOrderResult = await client.query(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order FROM collection_design_preview_images WHERE variant_id = $1",
        [variantId]
      );
      let nextSortOrder = sortOrderResult.rows[0].next_sort_order;

      const baseUrl = getPublicBaseUrl(req);
      const insertedRows = [];

      for (let i = 0; i < files.length; i++) {
        const imageUrl = `${baseUrl}/uploads/design-previews/${files[i].filename}`;
        // Only the very first file of the very first upload for this
        // variant becomes main automatically; every other image (in this
        // batch or a later one) uploads as non-main.
        const isMain = isFirstActiveImage && i === 0;

        const insertResult = await client.query(
          `
          INSERT INTO collection_design_preview_images
          (variant_id, image_url, sort_order, is_main, is_active)
          VALUES ($1, $2, $3, $4, true)
          RETURNING *
          `,
          [variantId, imageUrl, nextSortOrder, isMain]
        );

        insertedRows.push(insertResult.rows[0]);
        nextSortOrder += 1;
      }

      await client.query("COMMIT");
      res.status(201).json(insertedRows);
    } catch (err) {
      await client.query("ROLLBACK");
      // The transaction rolled back cleanly, so none of these files ended
      // up referenced by a persisted row — safe to delete all of them.
      for (const file of files) {
        fs.unlink(file.path, () => {});
      }
      console.error("Upload variant preview images error:", err);
      res.status(500).json({ error: "Server error" });
    } finally {
      client.release();
    }
  }
);

// PATCH /api/admin/customization/preview-images/:imageId
router.patch("/preview-images/:imageId", async (req, res) => {
  const { imageId } = req.params;
  const bodyKeys = Object.keys(req.body || {});
  const allowedKeys = ["sort_order", "is_active"];

  if (bodyKeys.length === 0) {
    return res.status(400).json({
      error: "At least one of sort_order or is_active is required",
    });
  }

  const unsupportedKeys = bodyKeys.filter((k) => !allowedKeys.includes(k));
  if (unsupportedKeys.length > 0) {
    return res.status(400).json({
      error: `Unsupported field(s): ${unsupportedKeys.join(", ")}. Only sort_order and is_active may be changed here.`,
    });
  }

  const { sort_order, is_active } = req.body;

  if (is_active !== undefined && typeof is_active !== "boolean") {
    return res.status(400).json({ error: "is_active must be a boolean" });
  }

  let parsedSortOrder = null;
  if (sort_order !== undefined) {
    parsedSortOrder = Number(sort_order);
    if (!Number.isInteger(parsedSortOrder)) {
      return res.status(400).json({ error: "sort_order must be an integer" });
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query(
      "SELECT id, variant_id, is_main, is_active FROM collection_design_preview_images WHERE id = $1 FOR UPDATE",
      [imageId]
    );

    if (currentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Preview image not found" });
    }

    const current = currentResult.rows[0];
    const isActiveParam = is_active === undefined ? null : is_active;

    // If this update deactivates the image, is_main is force-cleared in
    // the same statement — an inactive row must never stay flagged main.
    await client.query(
      `
      UPDATE collection_design_preview_images
      SET
        sort_order = COALESCE($1, sort_order),
        is_active = COALESCE($2, is_active),
        is_main = CASE WHEN $2 = false THEN false ELSE is_main END
      WHERE id = $3
      `,
      [parsedSortOrder, isActiveParam, imageId]
    );

    const wasMain = current.is_main;
    const isDeactivating = is_active === false;
    const isReactivating = is_active === true && current.is_active === false;

    // Deactivation rule: if the deactivated image was main, promote the
    // earliest remaining active image (by sort_order, then id). If none
    // remain active, the variant temporarily has no main image.
    if (isDeactivating && wasMain) {
      const nextMainResult = await client.query(
        `
        SELECT id FROM collection_design_preview_images
        WHERE variant_id = $1 AND is_active = true
        ORDER BY sort_order ASC, id ASC
        LIMIT 1
        `,
        [current.variant_id]
      );

      if (nextMainResult.rows.length > 0) {
        await client.query(
          "UPDATE collection_design_preview_images SET is_main = true WHERE id = $1",
          [nextMainResult.rows[0].id]
        );
      }
    }

    // Reactivation rule: reactivating never forces main status by itself.
    // It only becomes main if the variant currently has no active main
    // image at all, in which case the earliest active image is promoted
    // (which may or may not be this same image).
    if (isReactivating) {
      const existingMainResult = await client.query(
        `
        SELECT id FROM collection_design_preview_images
        WHERE variant_id = $1 AND is_active = true AND is_main = true
        `,
        [current.variant_id]
      );

      if (existingMainResult.rows.length === 0) {
        const earliestActiveResult = await client.query(
          `
          SELECT id FROM collection_design_preview_images
          WHERE variant_id = $1 AND is_active = true
          ORDER BY sort_order ASC, id ASC
          LIMIT 1
          `,
          [current.variant_id]
        );

        if (earliestActiveResult.rows.length > 0) {
          await client.query(
            "UPDATE collection_design_preview_images SET is_main = true WHERE id = $1",
            [earliestActiveResult.rows[0].id]
          );
        }
      }
    }

    const finalResult = await client.query(
      "SELECT * FROM collection_design_preview_images WHERE id = $1",
      [imageId]
    );

    await client.query("COMMIT");
    res.json(finalResult.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update preview image error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// PATCH /api/admin/customization/preview-images/:imageId/main
router.patch("/preview-images/:imageId/main", async (req, res) => {
  const { imageId } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const targetResult = await client.query(
      "SELECT id, variant_id, is_active FROM collection_design_preview_images WHERE id = $1 FOR UPDATE",
      [imageId]
    );

    if (targetResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Preview image not found" });
    }

    const target = targetResult.rows[0];

    if (!target.is_active) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Cannot set an inactive image as main. Reactivate it first.",
      });
    }

    // Clear the previous main before setting the new one — the partial
    // unique index (WHERE is_main = true) only allows one is_main = true
    // row per variant, so these must never overlap even momentarily.
    await client.query(
      "UPDATE collection_design_preview_images SET is_main = false WHERE variant_id = $1",
      [target.variant_id]
    );

    const updateResult = await client.query(
      "UPDATE collection_design_preview_images SET is_main = true WHERE id = $1 RETURNING *",
      [imageId]
    );

    await client.query("COMMIT");
    res.json(updateResult.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Set main preview image error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// PUT /api/admin/customization/variants/:variantId/preview-images/order
// Optional batch endpoint: reordering is a single logical operation, and
// without a transaction, N individual PATCH sort_order calls could leave
// an inconsistent order if one request fails partway through a drag-reorder
// UI action. The product gallery (admin.products.routes.js) has no
// equivalent batch endpoint to mirror, so this follows the same
// transaction/ownership-check conventions used elsewhere in this file.
//
// This is a full-gallery reorder, not a partial update: image_ids must
// contain every preview image belonging to the variant (active AND
// inactive) exactly once. A partial submission would leave omitted images
// at their old sort_order, which can collide with the newly-assigned
// values and produce a duplicate/ambiguous gallery order — so partial
// lists are rejected outright rather than silently leaving stale entries.
router.put("/variants/:variantId/preview-images/order", async (req, res) => {
  const { variantId } = req.params;
  const { image_ids } = req.body;

  if (!Array.isArray(image_ids)) {
    return res.status(400).json({ error: "image_ids must be an array" });
  }

  const parsedIds = image_ids.map((id) => Number(id));
  for (const id of parsedIds) {
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "image_ids must contain only valid positive integers",
      });
    }
  }

  if (new Set(parsedIds).size !== parsedIds.length) {
    return res.status(400).json({ error: "image_ids must not contain duplicates" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const variantCheck = await client.query(
      "SELECT id FROM collection_design_variants WHERE id = $1",
      [variantId]
    );
    if (variantCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Variant not found" });
    }

    // Never trust the supplied ids alone — the submitted set must exactly
    // equal every image (active and inactive) that actually belongs to
    // this variant: no id from another variant, no omitted id, no
    // nonexistent id. An empty variant with an empty image_ids array
    // naturally satisfies this (both sets are empty) and succeeds with an
    // empty result — no images means there's nothing to reorder, so this
    // isn't treated as an error case.
    const existingResult = await client.query(
      "SELECT id FROM collection_design_preview_images WHERE variant_id = $1",
      [variantId]
    );
    const existingIds = existingResult.rows.map((row) => row.id);

    const submittedSet = new Set(parsedIds);
    const existingSet = new Set(existingIds);
    const setsMatch =
      submittedSet.size === existingSet.size &&
      [...submittedSet].every((id) => existingSet.has(id));

    if (!setsMatch) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error:
          "image_ids must contain every preview image for this variant exactly once",
      });
    }

    for (let i = 0; i < parsedIds.length; i++) {
      await client.query(
        "UPDATE collection_design_preview_images SET sort_order = $1 WHERE id = $2",
        [i, parsedIds[i]]
      );
    }

    const finalResult = await client.query(
      `
      SELECT id, variant_id, image_url, sort_order, is_main, is_active, created_at
      FROM collection_design_preview_images
      WHERE variant_id = $1
      ORDER BY is_main DESC, sort_order ASC, id ASC
      `,
      [variantId]
    );

    await client.query("COMMIT");
    res.json(finalResult.rows);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Reorder variant preview images error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

module.exports = router;