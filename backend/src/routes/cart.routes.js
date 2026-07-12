const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware } = require("../middleware/auth.middleware");
const {
  groupImagesByProduct,
  resolveMainImageUrl,
} = require("../utils/productImages");

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
products.stock_quantity
      FROM cart_items
      JOIN products
        ON cart_items.product_id = products.id
      LEFT JOIN customization_options
        ON cart_items.customization_option_id = customization_options.id
      LEFT JOIN collection_designs
        ON cart_items.design_id = collection_designs.id
      LEFT JOIN design_collections
        ON collection_designs.collection_id = design_collections.id
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

      return {
        ...row,
        main_image_url: resolveMainImageUrl(relevantImages, row.image_url),
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
    } = req.body;

    const user_id = req.user.id;
    const qty = quantity || 1;

    if (!product_id) {
      return res.status(400).json({ error: "product_id is required" });
    }

    // 🔍 Stock guard: product must exist, be in stock, and have enough
    // stock left to cover what's already in the cart plus this addition.
    // Customized and non-customized cart items share the same product row,
    // so stock is checked as a total across all cart_items for this product.
    const productResult = await pool.query(
      "SELECT stock_quantity FROM products WHERE id = $1",
      [product_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

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

    // 🔍 Normalize design_id: missing/null/undefined/"" -> null, otherwise must be a valid number
    let design_id = null;
    if (rawDesignId !== null && rawDesignId !== undefined && rawDesignId !== "") {
      const parsedDesignId = Number(rawDesignId);

      if (!Number.isFinite(parsedDesignId)) {
        return res.status(400).json({ error: "Invalid design_id" });
      }

      design_id = parsedDesignId;
    }

    // 🔍 Validate the selected design, if any
    if (design_id) {
      const designCheck = await pool.query(
        `
        SELECT
          collection_designs.id,
          collection_designs.is_active AS design_is_active,
          design_collections.is_active AS collection_is_active,
          design_collections.product_id
        FROM collection_designs
        JOIN design_collections
          ON design_collections.id = collection_designs.collection_id
        WHERE collection_designs.id = $1
        `,
        [design_id]
      );

      if (designCheck.rows.length === 0) {
        return res.status(400).json({ error: "Invalid design_id" });
      }

      const design = designCheck.rows[0];

      if (!design.design_is_active) {
        return res.status(400).json({ error: "Selected design is not active" });
      }

      if (!design.collection_is_active) {
        return res
          .status(400)
          .json({ error: "Selected design's collection is not active" });
      }

      if (Number(design.product_id) !== Number(product_id)) {
        return res
          .status(400)
          .json({ error: "Selected design does not belong to this product" });
      }
    }

    // 🔍 Check if same exact item already exists
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
      `,
      [
        user_id,
        product_id,
        color,
        size,
        is_customized,
        customization_option_id,
        custom_text,
        custom_note,
        design_id,
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
        design_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
        user_id,
        product_id,
        color,
        size,
        qty,
        is_customized,
        customization_option_id,
        custom_text,
        custom_note,
        design_id,
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
router.patch("/:id", authMiddleware, async (req, res) => {
    try {
      const user_id = req.user.id;
      const cart_id = req.params.id;
      const { quantity } = req.body;

      if (!quantity) {
        return res.status(400).json({ error: "Quantity required" });
      }

      const cartItemResult = await pool.query(
        "SELECT product_id FROM cart_items WHERE id = $1 AND user_id = $2",
        [cart_id, user_id]
      );

      if (cartItemResult.rows.length === 0) {
        return res.status(404).json({ error: "Item not found" });
      }

      const { product_id } = cartItemResult.rows[0];

      const productResult = await pool.query(
        "SELECT stock_quantity FROM products WHERE id = $1",
        [product_id]
      );
      const stockQuantity = Number(
        productResult.rows[0]?.stock_quantity || 0
      );

      if (stockQuantity <= 0) {
        return res
          .status(400)
          .json({ error: "This product is out of stock." });
      }

      if (Number(quantity) > stockQuantity) {
        return res.status(400).json({
          error: `Only ${stockQuantity} item(s) available in stock.`,
        });
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
        "SELECT product_id FROM cart_items WHERE id = $1 AND user_id = $2",
        [id, user_id]
      );

      if (cartItemResult.rows.length === 0) {
        return res.status(404).json({ error: "Item not found" });
      }

      const { product_id } = cartItemResult.rows[0];

      const productResult = await pool.query(
        "SELECT stock_quantity FROM products WHERE id = $1",
        [product_id]
      );
      const stockQuantity = Number(
        productResult.rows[0]?.stock_quantity || 0
      );

      if (stockQuantity <= 0) {
        return res
          .status(400)
          .json({ error: "This product is out of stock." });
      }

      if (Number(quantity) > stockQuantity) {
        return res.status(400).json({
          error: `Only ${stockQuantity} item(s) available in stock.`,
        });
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