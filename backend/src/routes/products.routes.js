const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const { productSchema } = require("../validation/product.validation");
const { attachImageData } = require("../utils/productImages");

router.get("/", async (req, res) => {
  try {
    const productsResult = await pool.query("SELECT * FROM products ORDER BY id ASC");
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

    res.status(200).json(attachImageData(products, imagesResult.rows));
  } catch (err) {
    console.error("Error fetching products:", err.message);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.get("/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const productResult = await pool.query(
        "SELECT * FROM products WHERE id = $1",
        [id]
      );

      if (productResult.rows.length === 0) {
        return res.status(404).json({ error: "Product not found" });
      }

      const imagesResult = await pool.query(
        `
        SELECT id, product_id, image_url, sort_order, is_main
        FROM product_images
        WHERE product_id = $1 AND is_active = true
        ORDER BY sort_order ASC, id ASC
        `,
        [id]
      );

      const [productWithImages] = attachImageData(productResult.rows, imagesResult.rows);
      res.status(200).json(productWithImages);
    } catch (err) {
      console.error("Error fetching product:", err.message);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  router.post("/", authMiddleware, adminOnly, async (req, res) => {
    try {
        const parsed = productSchema.safeParse(req.body);

if (!parsed.success) {
  return res.status(400).json({
    error: parsed.error.flatten(),
  });
}

const {
  name,
  description,
  category,
  target_group,
  base_price,
  stock_quantity,
  image_url,
  is_customizable,
  is_active,
} = parsed.data;

      const result = await pool.query(
        `
        INSERT INTO products
        (name, description, category, target_group, base_price, stock_quantity, image_url, is_customizable, is_active)
        VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
        `,
        [
          name,
          description || null,
          category,
          target_group,
          base_price,
          stock_quantity ?? 0,
          image_url || null,
          is_customizable ?? false,
          is_active ?? true,
        ]
      );
      res.status(201).json({
        message: "Product created successfully",
        product: result.rows[0],
      });
    } catch (err) {
      console.error("Error creating product:", err.message);
      res.status(500).json({ error: "Failed to create product" });
    }
  });
  router.put("/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      description,
      category,
      target_group,
      base_price,
      stock_quantity,
      image_url,
      is_customizable,
      is_active,
    } = req.body;

    if (!name || !category || !target_group || base_price == null) {
      return res.status(400).json({
        error: "name, category, target_group, and base_price are required",
      });
    }

    const result = await pool.query(
      `
      UPDATE products
      SET
        name = $1,
        description = $2,
        category = $3,
        target_group = $4,
        base_price = $5,
        stock_quantity = $6,
        image_url = $7,
        is_customizable = $8,
        is_active = $9
      WHERE id = $10
      RETURNING *;
      `,
      [
        name,
        description || null,
        category,
        target_group,
        base_price,
        stock_quantity ?? 0,
        image_url || null,
        is_customizable ?? false,
        is_active ?? true,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json({
      message: "Product updated successfully",
      product: result.rows[0],
    });
  } catch (err) {
    console.error("Error updating product:", err.message);
    res.status(500).json({ error: "Failed to update product" });
  }
});
router.delete("/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
      const { id } = req.params;
  
      const result = await pool.query(
        `
        DELETE FROM products
        WHERE id = $1
        RETURNING *;
        `,
        [id]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Product not found" });
      }
  
      res.status(200).json({
        message: "Product deleted successfully",
        product: result.rows[0],
      });
    } catch (err) {
      console.error("Error deleting product:", err.message);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });
  module.exports = router;