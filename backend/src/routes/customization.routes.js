const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { attachImageData } = require("../utils/productImages");
const { computeAvailabilityStatus } = require("../utils/inventory");

// GET /api/customization/products
// Get all products that are customizable
router.get("/products", async (req, res) => {
  try {
    const productsResult = await pool.query(
      `
      SELECT
        id,
        name,
        description,
        category,
        target_group,
        base_price,
        stock_quantity,
        image_url,
        is_customizable,
        customization_extra_price,
        customization_note
      FROM products
      WHERE is_customizable = true
        AND is_active = true
      ORDER BY id ASC
      `
    );
    const products = productsResult.rows;

    const productIds = products.map((product) => product.id);
    const imagesResult = await pool.query(
      `
      SELECT id, product_id, image_url, sort_order, is_main
      FROM product_images
      WHERE is_active = true AND product_id = ANY($1::int[])
      ORDER BY product_id ASC, sort_order ASC, id ASC
      `,
      [productIds]
    );

    res.json(attachImageData(products, imagesResult.rows));
  } catch (err) {
    console.error("Get customizable products error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/customization/products/:productId
// Get full customization setup for one product
router.get("/products/:productId", async (req, res) => {
  try {
    const productId = req.params.productId;

    const productResult = await pool.query(
      `
      SELECT
        id,
        name,
        description,
        category,
        target_group,
        base_price,
        stock_quantity,
        image_url,
        is_customizable,
        customization_extra_price,
        customization_note,
        inventory_mode,
        sizing_mode,
        standard_size_label
      FROM products
      WHERE id = $1
        AND is_customizable = true
        AND is_active = true
      `,
      [productId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        error: "Product not found or not customizable",
      });
    }

    const imagesResult = await pool.query(
      `
      SELECT id, product_id, image_url, sort_order, is_main, color_id
      FROM product_images
      WHERE product_id = $1 AND is_active = true
      ORDER BY sort_order ASC, id ASC
      `,
      [productId]
    );

    const [productWithImages] = attachImageData(
      productResult.rows,
      imagesResult.rows
    );

    const colorsResult = await pool.query(
      `
      SELECT id, color_name, color_hex, sort_order
      FROM customizable_product_colors
      WHERE product_id = $1 AND is_active = true
      ORDER BY sort_order ASC, id ASC
      `,
      [productId]
    );

    const sizesResult = await pool.query(
      `
      SELECT id, size_label, sort_order
      FROM customizable_product_sizes
      WHERE product_id = $1 AND is_active = true
      ORDER BY sort_order ASC, id ASC
      `,
      [productId]
    );

    const optionsResult = await pool.query(
      `
      SELECT id, option_label, option_type, description, extra_price, sort_order
      FROM customization_options
      WHERE product_id = $1 AND is_active = true
      ORDER BY sort_order ASC, id ASC
      `,
      [productId]
    );

    const examplesResult = await pool.query(
      `
      SELECT id, image_url, caption, sort_order
      FROM customization_examples
      WHERE product_id = $1 AND is_active = true
      ORDER BY sort_order ASC, id ASC
      `,
      [productId]
    );

    const collectionsResult = await pool.query(
      `
      SELECT id, product_id, name, sort_order, is_active
      FROM design_collections
      WHERE product_id = $1 AND is_active = true
      ORDER BY sort_order ASC, id ASC
      `,
      [productId]
    );

    const collectionIds = collectionsResult.rows.map((c) => c.id);
    // Task I1: each design carries its owner-assigned placement/customization
    // option (design_placement_id / label) so the customer no longer picks a
    // possibly-conflicting placement independently — Task I2 wires that up
    // on the frontend. LEFT JOIN so a legacy design with no option assigned
    // yet still returns (with both fields null) instead of being dropped.
    const designsResult = await pool.query(
      `
      SELECT
        cd.id, cd.collection_id, cd.name, cd.image_url, cd.sort_order, cd.is_active,
        cd.customization_option_id,
        co.option_label AS customization_option_name
      FROM collection_designs cd
      LEFT JOIN customization_options co ON co.id = cd.customization_option_id
      WHERE cd.is_active = true AND cd.collection_id = ANY($1::int[])
      ORDER BY cd.collection_id ASC, cd.sort_order ASC, cd.id ASC
      `,
      [collectionIds]
    );

    // Customer-ready variants: active variant + active color belonging to
    // THIS product (never trust design_id alone — re-anchor to productId
    // here too) + design_id restricted to this product's own active
    // designs. Readiness rule 1 (collection active) and rule 2 (design
    // active) are already guaranteed by collectionsResult/designsResult
    // above only ever containing active rows.
    const designIds = designsResult.rows.map((d) => d.id);
    const variantsResult = await pool.query(
      `
      SELECT
        cdv.id,
        cdv.design_id,
        cdv.color_id,
        cdv.sort_order,
        c.color_name,
        c.color_hex
      FROM collection_design_variants cdv
      JOIN customizable_product_colors c ON c.id = cdv.color_id
      WHERE cdv.is_active = true
        AND c.is_active = true
        AND c.product_id = $1
        AND cdv.design_id = ANY($2::int[])
      ORDER BY cdv.design_id ASC, cdv.sort_order ASC, cdv.id ASC
      `,
      [productId, designIds]
    );

    const variantIds = variantsResult.rows.map((v) => v.id);

    const sizeRestrictionsResult = await pool.query(
      `
      SELECT variant_id, size_id
      FROM collection_design_variant_sizes
      WHERE variant_id = ANY($1::int[])
      ORDER BY variant_id ASC, size_id ASC
      `,
      [variantIds]
    );

    const previewImagesResult = await pool.query(
      `
      SELECT id, variant_id, image_url, sort_order, is_main
      FROM collection_design_preview_images
      WHERE is_active = true AND variant_id = ANY($1::int[])
      ORDER BY variant_id ASC, is_main DESC, sort_order ASC, id ASC
      `,
      [variantIds]
    );

    const sizeIdsByVariant = {};
    for (const row of sizeRestrictionsResult.rows) {
      if (!sizeIdsByVariant[row.variant_id]) {
        sizeIdsByVariant[row.variant_id] = [];
      }
      sizeIdsByVariant[row.variant_id].push(row.size_id);
    }

    const previewImagesByVariant = {};
    for (const row of previewImagesResult.rows) {
      if (!previewImagesByVariant[row.variant_id]) {
        previewImagesByVariant[row.variant_id] = [];
      }
      previewImagesByVariant[row.variant_id].push({
        id: row.id,
        image_url: row.image_url,
        sort_order: row.sort_order,
        is_main: row.is_main,
      });
    }

    // Readiness rule 5: a variant with zero active preview images is not
    // customer-ready and is dropped entirely — not just given an empty
    // preview_images array.
    const readyVariantsByDesign = {};
    for (const variant of variantsResult.rows) {
      const previewImages = previewImagesByVariant[variant.id] || [];
      if (previewImages.length === 0) continue;

      if (!readyVariantsByDesign[variant.design_id]) {
        readyVariantsByDesign[variant.design_id] = [];
      }

      // previewImages is already ordered is_main DESC, sort_order ASC, id
      // ASC by the query above, so [0] is the main image if one exists,
      // otherwise the first active image by display order — the same
      // fail-safe fallback resolveMainImageUrl() uses elsewhere.
      readyVariantsByDesign[variant.design_id].push({
        id: variant.id,
        color_id: variant.color_id,
        color_name: variant.color_name,
        color_hex: variant.color_hex,
        sort_order: variant.sort_order,
        allowed_size_ids: sizeIdsByVariant[variant.id] || [],
        preview_images: previewImages,
        main_preview_image_url: previewImages[0].image_url,
      });
    }

    const designsByCollection = {};
    for (const design of designsResult.rows) {
      if (!designsByCollection[design.collection_id]) {
        designsByCollection[design.collection_id] = [];
      }
      designsByCollection[design.collection_id].push({
        ...design,
        variants: readyVariantsByDesign[design.id] || [],
      });
    }

    const collections = collectionsResult.rows.map((collection) => ({
      ...collection,
      designs: designsByCollection[collection.id] || [],
    }));

    // Task K3: same customer-safe inventory shape as GET /api/products/:id/
    // availability — never an exact quantity, only a status label (GENERAL)
    // or per-active-combination availability (VARIANT).
    let inventory;
    if (productWithImages.inventory_mode !== "VARIANT") {
      inventory = {
        inventory_mode: "GENERAL",
        availability_status: computeAvailabilityStatus(
          productWithImages.stock_quantity
        ),
      };
    } else {
      const inventoryVariantsResult = await pool.query(
        "SELECT color_id, size_id, stock_quantity FROM product_inventory_variants WHERE product_id = $1",
        [productId]
      );

      const activeColorIds = new Set(colorsResult.rows.map((c) => c.id));
      const activeSizeIds = new Set(sizesResult.rows.map((s) => s.id));

      const stockByKey = new Map();
      for (const v of inventoryVariantsResult.rows) {
        if (v.color_id !== null && !activeColorIds.has(v.color_id)) continue;
        if (!activeSizeIds.has(v.size_id)) continue;
        const key = `${v.color_id === null ? "null" : v.color_id}:${v.size_id}`;
        stockByKey.set(key, v.stock_quantity);
      }

      const expectedPairs =
        colorsResult.rows.length > 0
          ? colorsResult.rows.flatMap((c) => sizesResult.rows.map((s) => [c.id, s.id]))
          : sizesResult.rows.map((s) => [null, s.id]);

      inventory = {
        inventory_mode: "VARIANT",
        combinations: expectedPairs.map(([colorId, sizeId]) => {
          const key = `${colorId === null ? "null" : colorId}:${sizeId}`;
          const stockQuantity = stockByKey.has(key) ? stockByKey.get(key) : 0;
          return {
            color_id: colorId,
            size_id: sizeId,
            is_available: stockQuantity > 0,
            availability_status: computeAvailabilityStatus(stockQuantity),
          };
        }),
      };
    }

    res.json({
      product: productWithImages,
      colors: colorsResult.rows,
      sizes: sizesResult.rows,
      options: optionsResult.rows,
      examples: examplesResult.rows,
      collections,
      inventory,
    });
  } catch (err) {
    console.error("Get customization product config error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;