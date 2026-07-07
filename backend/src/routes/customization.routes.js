const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { attachImageData } = require("../utils/productImages");

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
        image_url,
        is_customizable,
        customization_extra_price,
        customization_note
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
    const designsResult = await pool.query(
      `
      SELECT id, collection_id, name, image_url, sort_order, is_active
      FROM collection_designs
      WHERE is_active = true AND collection_id = ANY($1::int[])
      ORDER BY collection_id ASC, sort_order ASC, id ASC
      `,
      [collectionIds]
    );

    const designsByCollection = {};
    for (const design of designsResult.rows) {
      if (!designsByCollection[design.collection_id]) {
        designsByCollection[design.collection_id] = [];
      }
      designsByCollection[design.collection_id].push(design);
    }

    const collections = collectionsResult.rows.map((collection) => ({
      ...collection,
      designs: designsByCollection[collection.id] || [],
    }));

    res.json({
      product: productResult.rows[0],
      colors: colorsResult.rows,
      sizes: sizesResult.rows,
      options: optionsResult.rows,
      examples: examplesResult.rows,
      collections,
    });
  } catch (err) {
    console.error("Get customization product config error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;