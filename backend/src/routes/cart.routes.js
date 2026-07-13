const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware } = require("../middleware/auth.middleware");
const {
  groupImagesByProduct,
  resolveMainImageUrl,
} = require("../utils/productImages");
const {
  computeAvailabilityStatus,
  resolveInventoryVariant,
} = require("../utils/inventory");

// ✅ TEST
router.get("/test", (req, res) => {
  res.send("Cart route working");
});

// ✅ GET CART
router.get("/", authMiddleware, async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await pool.query(
      `
      SELECT
        cart_items.id,
        cart_items.user_id,
        cart_items.product_id,
        cart_items.quantity,
        cart_items.size,
        cart_items.color,

        cart_items.is_customized,
        cart_items.customization_option_id,
        cart_items.custom_text,
        cart_items.custom_note,

        customization_options.option_label AS customization_label,
        customization_options.extra_price AS customization_option_extra_price,

        cart_items.design_id,
        collection_designs.name AS design_label,
        collection_designs.image_url AS design_image_url,
        design_collections.name AS collection_name,

        cart_items.design_variant_id,
        variant_design.name AS design_name,
        variant_color.id AS design_color_id,
        variant_color.color_name AS design_color_name,

                products.name AS product_name,
(
  products.base_price
  + CASE
      WHEN cart_items.is_customized = true
      THEN COALESCE(products.customization_extra_price, 0) + COALESCE(customization_options.extra_price, 0)
      ELSE 0
    END
) AS price,
products.customization_extra_price,
products.image_url,
products.stock_quantity,
products.inventory_mode,
products.sizing_mode,
products.standard_size_label
      FROM cart_items
      JOIN products
        ON cart_items.product_id = products.id
      LEFT JOIN customization_options
        ON cart_items.customization_option_id = customization_options.id
      LEFT JOIN collection_designs
        ON cart_items.design_id = collection_designs.id
      LEFT JOIN design_collections
        ON collection_designs.collection_id = design_collections.id
      LEFT JOIN collection_design_variants
        ON cart_items.design_variant_id = collection_design_variants.id
      LEFT JOIN collection_designs AS variant_design
        ON collection_design_variants.design_id = variant_design.id
      LEFT JOIN customizable_product_colors AS variant_color
        ON collection_design_variants.color_id = variant_color.id
      WHERE cart_items.user_id = $1
      ORDER BY cart_items.id ASC
      `,
      [user_id]
    );

    const cartRows = result.rows;
    const productIds = [...new Set(cartRows.map((row) => row.product_id))];

    const imagesResult = await pool.query(
      `
      SELECT id, product_id, image_url, sort_order, is_main, color_id
      FROM product_images
      WHERE is_active = true AND product_id = ANY($1::int[])
      ORDER BY product_id ASC, sort_order ASC, id ASC
      `,
      [productIds]
    );
    const imagesByProduct = groupImagesByProduct(imagesResult.rows);

    // cart_items.color is a free-text snapshot (e.g. "black"), not a
    // color_id — resolve it back to the product's actual color_id so a
    // color-specific gallery image can be preferred over the general one.
    // Reliable as long as the color name hasn't been renamed since this
    // item was added (same assumption the rest of the app already makes
    // by storing color as text instead of an id).
    const colorsResult = await pool.query(
      `
      SELECT id, product_id, color_name
      FROM customizable_product_colors
      WHERE product_id = ANY($1::int[])
      `,
      [productIds]
    );
    const colorIdByProductAndName = new Map(
      colorsResult.rows.map((row) => [
        `${row.product_id}::${row.color_name}`,
        row.id,
      ])
    );

    // Task K3: batched inventory availability for every VARIANT-mode
    // product's cart rows — resolved fresh by color/size NAME every time
    // (never a cached id), so a color/size renamed or deactivated since
    // this item was added is reflected immediately, and never exposes an
    // exact stock number, only the computed customer-safe status.
    const variantProductIds = [
      ...new Set(
        cartRows
          .filter((row) => row.inventory_mode === "VARIANT")
          .map((row) => row.product_id)
      ),
    ];

    const [activeColorsResult, activeSizesResult, inventoryVariantsResult] =
      await Promise.all([
        pool.query(
          "SELECT id, product_id, color_name FROM customizable_product_colors WHERE product_id = ANY($1::int[]) AND is_active = true",
          [variantProductIds]
        ),
        pool.query(
          "SELECT id, product_id, size_label FROM customizable_product_sizes WHERE product_id = ANY($1::int[]) AND is_active = true",
          [variantProductIds]
        ),
        pool.query(
          "SELECT product_id, color_id, size_id, stock_quantity FROM product_inventory_variants WHERE product_id = ANY($1::int[])",
          [variantProductIds]
        ),
      ]);

    const activeColorsByProduct = new Map();
    for (const c of activeColorsResult.rows) {
      if (!activeColorsByProduct.has(c.product_id)) {
        activeColorsByProduct.set(c.product_id, []);
      }
      activeColorsByProduct.get(c.product_id).push(c);
    }

    const activeSizesByProduct = new Map();
    for (const sizeRow of activeSizesResult.rows) {
      if (!activeSizesByProduct.has(sizeRow.product_id)) {
        activeSizesByProduct.set(sizeRow.product_id, []);
      }
      activeSizesByProduct.get(sizeRow.product_id).push(sizeRow);
    }

    const inventoryStockByKey = new Map();
    for (const v of inventoryVariantsResult.rows) {
      const key = `${v.product_id}::${v.color_id === null ? "null" : v.color_id}::${v.size_id}`;
      inventoryStockByKey.set(key, v.stock_quantity);
    }

    function computeCartRowAvailability(row) {
      if (row.inventory_mode !== "VARIANT") {
        return {
          inventory_mode: "GENERAL",
          is_available: Number(row.stock_quantity || 0) > 0,
          availability_status: computeAvailabilityStatus(row.stock_quantity),
        };
      }

      const productColors = activeColorsByProduct.get(row.product_id) || [];
      const productSizes = activeSizesByProduct.get(row.product_id) || [];
      const hasColors = productColors.length > 0;

      let colorId = null;
      if (hasColors) {
        const normalizedColor = String(row.color || "").trim().toLowerCase();
        const match = productColors.find(
          (c) => c.color_name.trim().toLowerCase() === normalizedColor
        );
        if (!match) {
          // The selected color is no longer active/valid for this product —
          // unavailable, never falls back to guessing another one.
          return {
            inventory_mode: "VARIANT",
            is_available: false,
            availability_status: "OUT_OF_STOCK",
          };
        }
        colorId = match.id;
      }

      const normalizedSize = String(row.size || "").trim().toLowerCase();
      const sizeMatch = productSizes.find(
        (s) => s.size_label.trim().toLowerCase() === normalizedSize
      );
      if (!sizeMatch) {
        return {
          inventory_mode: "VARIANT",
          is_available: false,
          availability_status: "OUT_OF_STOCK",
        };
      }

      const key = `${row.product_id}::${colorId === null ? "null" : colorId}::${sizeMatch.id}`;
      // Missing row (no combination saved yet) is treated as zero stock —
      // an incomplete Variant matrix never falls back to General stock.
      const stockQuantity = inventoryStockByKey.has(key)
        ? inventoryStockByKey.get(key)
        : 0;

      return {
        inventory_mode: "VARIANT",
        is_available: stockQuantity > 0,
        availability_status: computeAvailabilityStatus(stockQuantity),
      };
    }

    // Design-variant preview images (Task H1 image priority, tier 1/2):
    // batched in one query, never exposing inactive rows, exactly like the
    // product-images batching above — no per-row query.
    const variantIds = [
      ...new Set(cartRows.map((row) => row.design_variant_id).filter(Boolean)),
    ];

    const variantPreviewsResult = await pool.query(
      `
      SELECT id, variant_id, image_url, sort_order, is_main
      FROM collection_design_preview_images
      WHERE is_active = true AND variant_id = ANY($1::int[])
      ORDER BY variant_id ASC, is_main DESC, sort_order ASC, id ASC
      `,
      [variantIds]
    );
    const previewsByVariant = {};
    for (const previewRow of variantPreviewsResult.rows) {
      if (!previewsByVariant[previewRow.variant_id]) {
        previewsByVariant[previewRow.variant_id] = [];
      }
      previewsByVariant[previewRow.variant_id].push(previewRow);
    }

    const cartRowsWithImages = cartRows.map((row) => {
      const productImages = imagesByProduct.get(row.product_id) || [];

      const matchedColorId = row.color
        ? colorIdByProductAndName.get(`${row.product_id}::${row.color}`)
        : undefined;

      const colorImages =
        matchedColorId !== undefined
          ? productImages.filter(
              (img) => Number(img.color_id) === Number(matchedColorId)
            )
          : [];

      const relevantImages =
        colorImages.length > 0 ? colorImages : productImages;

      // Legacy/deactivated rows (design_id but no design_variant_id, or a
      // variant with no active previews left) simply have an empty list
      // here and fall through to the existing product-image resolution —
      // never crash, never invent a variant.
      const variantPreviews = row.design_variant_id
        ? previewsByVariant[row.design_variant_id] || []
        : [];

      // Already ordered is_main DESC, sort_order ASC, id ASC by the query
      // above, so [0] is the variant's main preview image (or its earliest
      // active image if none is flagged main).
      const designMainPreviewImageUrl =
        variantPreviews.length > 0 ? variantPreviews[0].image_url : null;

      // CART IMAGE PRIORITY:
      // 1-2. design variant's active main/first preview image
      // 3-5. existing product-color gallery resolution (color image ->
      //      general product image -> null), untouched.
      const mainImageUrl =
        designMainPreviewImageUrl ||
        resolveMainImageUrl(relevantImages, row.image_url);

      return {
        ...row,
        ...computeCartRowAvailability(row),
        // Task K3: products.stock_quantity is meaningless once a product is
        // VARIANT-mode (it's no longer the source of truth) — never leave a
        // stale whole-product number sitting in the response where a
        // customer could mistake it for this exact combination's stock.
        // GENERAL items keep it exactly as before (needed by the existing
        // quantity-stepper max-check).
        stock_quantity: row.inventory_mode === "VARIANT" ? null : row.stock_quantity,
        design_main_preview_image_url: designMainPreviewImageUrl,
        main_image_url: mainImageUrl,
      };
    });

    res.json(cartRowsWithImages);
  } catch (err) {
    console.error("Get cart error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ ADD TO CART
router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      product_id,
      color,
      size,
      quantity,
      is_customized = false,
      customization_option_id = null,
      custom_text = null,
      custom_note = null,
      design_id: rawDesignId = null,
      design_variant_id: rawDesignVariantId = null,
    } = req.body;

    const user_id = req.user.id;
    const qty = quantity || 1;

    if (!product_id) {
      return res.status(400).json({ error: "product_id is required" });
    }

    // 🔍 Product guard: must exist. GENERAL stock is checked immediately
    // below (unchanged behavior); VARIANT stock is checked further down,
    // after color/size (and any design variant) have been resolved to
    // their final canonical values — Task K3.
    const productResult = await pool.query(
      "SELECT stock_quantity, inventory_mode, sizing_mode FROM products WHERE id = $1",
      [product_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const inventoryMode = productResult.rows[0].inventory_mode;
    const sizingMode = productResult.rows[0].sizing_mode;

    // Task L1: a STANDARD product must never combine with VARIANT
    // inventory — this should already be structurally impossible (VARIANT
    // requires >=1 active size, STANDARD requires 0), but block it
    // explicitly rather than trust that invariant blindly.
    if (sizingMode === "STANDARD" && inventoryMode === "VARIANT") {
      return res.status(400).json({
        error: "This product's configuration is invalid. Please contact support.",
      });
    }

    if (inventoryMode !== "VARIANT") {
      // Existing GENERAL behavior, unchanged: customized and non-customized
      // cart items share the same product row, so stock is checked as a
      // total across all cart_items for this product.
      const stockQuantity = Number(productResult.rows[0].stock_quantity || 0);

      if (stockQuantity <= 0) {
        return res.status(400).json({ error: "This product is out of stock." });
      }

      const existingQtyResult = await pool.query(
        `
        SELECT COALESCE(SUM(quantity), 0) AS total_quantity
        FROM cart_items
        WHERE user_id = $1 AND product_id = $2
        `,
        [user_id, product_id]
      );
      const existingCartQuantity = Number(
        existingQtyResult.rows[0].total_quantity || 0
      );

      if (existingCartQuantity + qty > stockQuantity) {
        const remaining = Math.max(stockQuantity - existingCartQuantity, 0);
        return res.status(400).json({
          error: `Only ${remaining} item(s) available in stock.`,
        });
      }
    }

    // 🔍 Normalize design_id: missing/null/undefined/"" -> null, otherwise must be a valid number
    let design_id = null;
    if (rawDesignId !== null && rawDesignId !== undefined && rawDesignId !== "") {
      const parsedDesignId = Number(rawDesignId);

      if (!Number.isFinite(parsedDesignId)) {
        return res.status(400).json({ error: "Invalid design_id" });
      }

      design_id = parsedDesignId;
    }

    // 🔍 Normalize design_variant_id the same way
    let design_variant_id = null;
    if (
      rawDesignVariantId !== null &&
      rawDesignVariantId !== undefined &&
      rawDesignVariantId !== ""
    ) {
      const parsedVariantId = Number(rawDesignVariantId);

      if (!Number.isFinite(parsedVariantId)) {
        return res.status(400).json({ error: "Invalid design_variant_id" });
      }

      design_variant_id = parsedVariantId;
    }

    // A design-linked cart item must always carry both ids together — the
    // frontend only ever sends design_variant_id once selectedDesignVariant
    // has been resolved for the chosen design, so a request with only one
    // of the two is treated as incomplete/untrusted rather than guessed at.
    if ((design_id && !design_variant_id) || (design_variant_id && !design_id)) {
      return res.status(400).json({
        error:
          "Selected design configuration is incomplete. Please choose the design again.",
      });
    }

    // Canonical color/size for this cart row. For a design-linked item
    // these are overwritten below from the validated variant instead of
    // the raw submitted strings; for an ordinary (non-design) item they
    // stay exactly as submitted — unchanged from existing behavior.
    let resolvedColor = color;
    let resolvedSize = size;

    // 🔍 Task L1: sizing-mode validation. STANDARD is fully resolved right
    // here (never enters the design branch's own size logic — a STANDARD
    // product's size is always null, full stop). MULTI_SIZE without a
    // design is validated here too, since the design branch below only
    // validates size for design-linked items — a plain MULTI_SIZE item
    // never had real size validation before Task L1. A MULTI_SIZE
    // design-linked item keeps using the design branch's own (already
    // correct, variant-restriction-aware) size validation, untouched.
    if (sizingMode === "STANDARD") {
      const submittedSize = typeof size === "string" ? size.trim() : size;

      if (submittedSize !== null && submittedSize !== undefined && submittedSize !== "") {
        return res.status(400).json({ error: "This product uses a single fixed size." });
      }

      resolvedSize = null;
    } else if (!design_id) {
      const activeSizesResult = await pool.query(
        "SELECT size_label FROM customizable_product_sizes WHERE product_id = $1 AND is_active = true",
        [product_id]
      );
      const activeSizes = activeSizesResult.rows;

      if (activeSizes.length === 0) {
        return res.status(400).json({
          error: "This product's sizes are not configured yet.",
        });
      }

      const submittedSizeLabel =
        typeof size === "string" ? size.trim().toLowerCase() : "";

      if (!submittedSizeLabel) {
        return res.status(400).json({ error: "Please select a size." });
      }

      const matchedSize = activeSizes.find(
        (s) => s.size_label.trim().toLowerCase() === submittedSizeLabel
      );

      if (!matchedSize) {
        return res
          .status(400)
          .json({ error: "Selected size is not available for this product." });
      }

      resolvedSize = matchedSize.size_label;
    }

    // 🔍 Validate the selected design and its exact color/size variant, if
    // any. Every step re-derives trust from the database — the submitted
    // design_id, product_id, color text, and variant id are never assumed
    // to already agree with each other.
    if (design_id) {
      const variantResult = await pool.query(
        `
        SELECT
          cdv.id AS variant_id,
          cdv.design_id AS variant_design_id,
          cdv.color_id AS variant_color_id,
          cdv.is_active AS variant_is_active,
          cd.is_active AS design_is_active,
          dc.is_active AS collection_is_active,
          dc.product_id AS collection_product_id,
          col.color_name AS variant_color_name,
          col.is_active AS variant_color_is_active,
          col.product_id AS variant_color_product_id
        FROM collection_design_variants cdv
        JOIN collection_designs cd ON cd.id = cdv.design_id
        JOIN design_collections dc ON dc.id = cd.collection_id
        JOIN customizable_product_colors col ON col.id = cdv.color_id
        WHERE cdv.id = $1
        `,
        [design_variant_id]
      );

      if (variantResult.rows.length === 0) {
        return res
          .status(400)
          .json({ error: "Selected design is not available for this product." });
      }

      const variant = variantResult.rows[0];

      // variant.design_id belonging to its collection, and that collection
      // owning it, is already guaranteed by the JOIN chain above — no
      // separate check needed for "design belongs to the collection".

      if (Number(variant.variant_design_id) !== Number(design_id)) {
        return res
          .status(400)
          .json({ error: "Selected design is not available for this product." });
      }

      if (
        !variant.collection_is_active ||
        !variant.design_is_active ||
        Number(variant.collection_product_id) !== Number(product_id)
      ) {
        return res
          .status(400)
          .json({ error: "Selected design is not available for this product." });
      }

      if (
        !variant.variant_is_active ||
        !variant.variant_color_is_active ||
        Number(variant.variant_color_product_id) !== Number(product_id)
      ) {
        return res
          .status(400)
          .json({ error: "Selected design is not available in this color." });
      }

      const previewResult = await pool.query(
        `
        SELECT id
        FROM collection_design_preview_images
        WHERE variant_id = $1 AND is_active = true
        LIMIT 1
        `,
        [design_variant_id]
      );

      if (previewResult.rows.length === 0) {
        return res
          .status(400)
          .json({ error: "Selected design preview is no longer available." });
      }

      // Canonical color: always the variant's own color, never the
      // submitted string. This makes a manipulated/mismatched client color
      // value irrelevant rather than requiring a separate reject-on-
      // mismatch check, and sidesteps fragile case-sensitive comparisons
      // entirely.
      resolvedColor = variant.variant_color_name;

      // Size validation, scoped to this product and this exact variant.
      const productSizesResult = await pool.query(
        `
        SELECT id, size_label
        FROM customizable_product_sizes
        WHERE product_id = $1 AND is_active = true
        `,
        [product_id]
      );
      const hasSizes = productSizesResult.rows.length > 0;

      if (hasSizes) {
        const submittedSizeLabel =
          typeof size === "string" ? size.trim().toLowerCase() : "";

        if (!submittedSizeLabel) {
          return res.status(400).json({ error: "Please select a size." });
        }

        const matchedSize = productSizesResult.rows.find(
          (s) => s.size_label.trim().toLowerCase() === submittedSizeLabel
        );

        if (!matchedSize) {
          return res
            .status(400)
            .json({ error: "Selected size is not available for this product." });
        }

        const restrictionsResult = await pool.query(
          "SELECT size_id FROM collection_design_variant_sizes WHERE variant_id = $1",
          [design_variant_id]
        );

        if (restrictionsResult.rows.length > 0) {
          const allowedSizeIds = restrictionsResult.rows.map((r) => r.size_id);

          if (!allowedSizeIds.includes(matchedSize.id)) {
            return res
              .status(400)
              .json({ error: "Selected design is not available in this size." });
          }
        }

        // Canonical size label resolved from the DB, not the raw
        // (possibly differently-cased) submitted string.
        resolvedSize = matchedSize.size_label;
      } else {
        // No sizes configured for this product — normalize to the
        // project's existing no-size representation (null) regardless of
        // what was submitted. A variant for a sizeless product should
        // never actually have restriction rows (the admin size-restriction
        // endpoint only allows restricting to sizes that exist for the
        // product), so there is nothing meaningful to validate here.
        resolvedSize = null;
      }
    }

    // 🔍 Task K3: VARIANT stock guard — runs after design resolution above,
    // using the FINAL canonical resolvedColor/resolvedSize (never the raw
    // submitted strings), so a design-linked item is checked against the
    // exact color its variant actually belongs to. Existing quantity is
    // aggregated only across cart rows resolving to this SAME combination —
    // unlike GENERAL, different colors/sizes of a VARIANT product draw from
    // independent stock pools, never a shared per-product total.
    if (inventoryMode === "VARIANT") {
      const resolution = await resolveInventoryVariant(
        pool,
        product_id,
        resolvedColor,
        resolvedSize
      );

      if (!resolution.ok) {
        return res.status(400).json({
          error: "This color and size combination is out of stock.",
        });
      }

      const variantStock = Number(resolution.variant.stock_quantity || 0);

      if (variantStock <= 0) {
        return res.status(400).json({
          error: "This color and size combination is out of stock.",
        });
      }

      const existingVariantQtyResult = await pool.query(
        `
        SELECT COALESCE(SUM(quantity), 0) AS total_quantity
        FROM cart_items
        WHERE user_id = $1
          AND product_id = $2
          AND LOWER(TRIM(color)) = LOWER(TRIM($3))
          AND COALESCE(LOWER(TRIM(size)), '') = COALESCE(LOWER(TRIM($4)), '')
        `,
        [user_id, product_id, resolvedColor || "", resolvedSize]
      );
      const existingVariantQuantity = Number(
        existingVariantQtyResult.rows[0].total_quantity || 0
      );

      if (existingVariantQuantity + qty > variantStock) {
        return res.status(400).json({
          error: "Only the available quantity can be added.",
        });
      }
    }

    // 🔍 Check if same exact item already exists. design_variant_id is
    // included null-safely (COALESCE) just like design_id/customization_
    // option_id — same product/color/size but a different design variant,
    // or the same design on a different color/size, must never merge into
    // an existing legacy row that has no variant at all.
    const existing = await pool.query(
      `
      SELECT *
      FROM cart_items
      WHERE user_id = $1
        AND product_id = $2
        AND color = $3
        AND COALESCE(size, '') = COALESCE($4, '')
        AND is_customized = $5
        AND COALESCE(customization_option_id, 0) = COALESCE($6, 0)
        AND COALESCE(custom_text, '') = COALESCE($7, '')
        AND COALESCE(custom_note, '') = COALESCE($8, '')
        AND COALESCE(design_id, 0) = COALESCE($9, 0)
        AND COALESCE(design_variant_id, 0) = COALESCE($10, 0)
      `,
      [
        user_id,
        product_id,
        resolvedColor,
        resolvedSize,
        is_customized,
        customization_option_id,
        custom_text,
        custom_note,
        design_id,
        design_variant_id,
      ]
    );

    if (existing.rows.length > 0) {
      const updated = await pool.query(
        `
        UPDATE cart_items
        SET quantity = quantity + $1
        WHERE id = $2
        RETURNING *
        `,
        [qty, existing.rows[0].id]
      );

      return res.json(updated.rows[0]);
    }

    // ➕ Insert new item
    const result = await pool.query(
      `
      INSERT INTO cart_items
      (
        user_id,
        product_id,
        color,
        size,
        quantity,
        is_customized,
        customization_option_id,
        custom_text,
        custom_note,
        design_id,
        design_variant_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
      `,
      [
        user_id,
        product_id,
        resolvedColor,
        resolvedSize,
        qty,
        is_customized,
        customization_option_id,
        custom_text,
        custom_note,
        design_id,
        design_variant_id,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Cart error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

//  DELETE FROM CART  ← 🔥 ADD IT HERE (at the bottom is best)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const user_id = req.user.id;
    const cart_id = req.params.id;

    const result = await pool.query(
      "DELETE FROM cart_items WHERE id = $1 AND user_id = $2 RETURNING *",
      [cart_id, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json({ message: "Item removed from cart" });
  } catch (err) {
    console.error("Delete cart error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// UPDATE CART ITEM QUANTITY
// Task K3: shared by PATCH/PUT quantity-update below. GENERAL behavior is
// byte-identical to before; VARIANT resolves the item's own color/size to
// its exact inventory row instead of the whole-product stock_quantity.
async function validateQuantityAgainstStock(productId, color, size, quantity) {
  const productResult = await pool.query(
    "SELECT stock_quantity, inventory_mode FROM products WHERE id = $1",
    [productId]
  );
  const product = productResult.rows[0];

  if (!product) {
    return { ok: false, error: "Product not found." };
  }

  if (product.inventory_mode !== "VARIANT") {
    const stockQuantity = Number(product.stock_quantity || 0);

    if (stockQuantity <= 0) {
      return { ok: false, error: "This product is out of stock." };
    }

    if (Number(quantity) > stockQuantity) {
      return {
        ok: false,
        error: `Only ${stockQuantity} item(s) available in stock.`,
      };
    }

    return { ok: true };
  }

  const resolution = await resolveInventoryVariant(pool, productId, color, size);

  if (!resolution.ok) {
    return {
      ok: false,
      error: "This color and size combination is out of stock.",
    };
  }

  const variantStock = Number(resolution.variant.stock_quantity || 0);

  if (variantStock <= 0) {
    return {
      ok: false,
      error: "This color and size combination is out of stock.",
    };
  }

  if (Number(quantity) > variantStock) {
    return { ok: false, error: "Only the available quantity can be added." };
  }

  return { ok: true };
}

router.patch("/:id", authMiddleware, async (req, res) => {
    try {
      const user_id = req.user.id;
      const cart_id = req.params.id;
      const { quantity } = req.body;

      if (!quantity) {
        return res.status(400).json({ error: "Quantity required" });
      }

      const cartItemResult = await pool.query(
        "SELECT product_id, color, size FROM cart_items WHERE id = $1 AND user_id = $2",
        [cart_id, user_id]
      );

      if (cartItemResult.rows.length === 0) {
        return res.status(404).json({ error: "Item not found" });
      }

      const { product_id, color, size } = cartItemResult.rows[0];

      const validation = await validateQuantityAgainstStock(
        product_id,
        color,
        size,
        quantity
      );

      if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
      }

      const result = await pool.query(
        `UPDATE cart_items
         SET quantity = $1
         WHERE id = $2 AND user_id = $3
         RETURNING *`,
        [quantity, cart_id, user_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Item not found" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Update cart error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });
// This route updates the quantity of a specific cart item
router.put("/:id", authMiddleware, async (req, res) => {
    try {
      const user_id = req.user.id;
      const id = req.params.id;
      const { quantity } = req.body;

      if (!quantity) {
        return res.status(400).json({ error: "Quantity required" });
      }

      const cartItemResult = await pool.query(
        "SELECT product_id, color, size FROM cart_items WHERE id = $1 AND user_id = $2",
        [id, user_id]
      );

      if (cartItemResult.rows.length === 0) {
        return res.status(404).json({ error: "Item not found" });
      }

      const { product_id, color, size } = cartItemResult.rows[0];

      const validation = await validateQuantityAgainstStock(
        product_id,
        color,
        size,
        quantity
      );

      if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
      }

      const result = await pool.query(
        "UPDATE cart_items SET quantity = $1 WHERE id = $2 AND user_id = $3 RETURNING *",
        [quantity, id, user_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Item not found" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Update cart error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

module.exports = router;