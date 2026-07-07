const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware } = require("../middleware/auth.middleware");

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
products.image_url
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

    res.json(result.rows);
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
        AND size = $4
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
      const id = req.params.id;
      const { quantity } = req.body;
  
      const result = await pool.query(
        "UPDATE cart_items SET quantity = $1 WHERE id = $2 RETURNING *",
        [quantity, id]
      );
  
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Update cart error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

module.exports = router;