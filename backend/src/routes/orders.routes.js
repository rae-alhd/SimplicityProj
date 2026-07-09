const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware } = require("../middleware/auth.middleware");

/* ─────────────────────────────────────────────
   HELPER: admin-only guard
   Add this here since you may not have a
   dedicated adminMiddleware yet.
   If you already have one, replace this with:
     const adminMiddleware = require("../middleware/admin.middleware");
───────────────────────────────────────────── */
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}

/* ─────────────────────────────────────────────
   POST /api/orders
   Create a new order from the user's cart.
   Body: { customer_name, phone, address, notes }
───────────────────────────────────────────── */
router.post("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { customer_name, phone, address, notes } = req.body;

  if (!customer_name || !address) {
    return res
      .status(400)
      .json({ error: "customer_name and address are required." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Fetch user's cart items joined with product prices and customization details
const cartResult = await client.query(
  `
  SELECT
    ci.product_id,
    ci.size,
    ci.color,
    ci.quantity,

    ci.is_customized,
    ci.customization_option_id,
    ci.custom_text,
    ci.custom_note,
    ci.design_id,

    p.base_price,
    p.customization_extra_price,
    p.name AS product_name,
    p.is_active,

    co.option_label AS customization_label,
    co.extra_price AS customization_option_extra_price,

    cd.name AS design_label,
    cd.image_url AS design_image_url,
    dc.name AS collection_name,

    (
      p.base_price
      + CASE
          WHEN ci.is_customized = true
          THEN COALESCE(p.customization_extra_price, 0) + COALESCE(co.extra_price, 0)
          ELSE 0
        END
    ) AS final_unit_price

  FROM cart_items ci
  JOIN products p ON p.id = ci.product_id
  LEFT JOIN customization_options co ON ci.customization_option_id = co.id
  LEFT JOIN collection_designs cd ON ci.design_id = cd.id
  LEFT JOIN design_collections dc ON cd.collection_id = dc.id
  WHERE ci.user_id = $1
  `,
  [userId]
);

    const cartItems = cartResult.rows;

    if (cartItems.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Your cart is empty." });
    }

    // 1.5 Aggregate cart quantity per product (same product can appear as
    // multiple cart rows with different size/color/customization/design,
    // but they all draw from the same products.stock_quantity pool).
    const quantityByProduct = new Map();
    for (const item of cartItems) {
      const current = quantityByProduct.get(item.product_id) || 0;
      quantityByProduct.set(
        item.product_id,
        current + Number(item.quantity || 0)
      );
    }

    // 1.6 Check stock for every product before creating the order, locking
    // each product row so concurrent checkouts can't oversell the same stock.
    for (const [productId, requestedQuantity] of quantityByProduct.entries()) {
      const stockResult = await client.query(
        "SELECT name, stock_quantity FROM products WHERE id = $1 FOR UPDATE",
        [productId]
      );

      if (stockResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Product not found." });
      }

      const { name, stock_quantity } = stockResult.rows[0];
      const availableStock = Number(stock_quantity || 0);

      if (availableStock <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `${name} is out of stock.` });
      }

      if (requestedQuantity > availableStock) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Only ${availableStock} item(s) available for ${name}.`,
        });
      }
    }

    // 2. Calculate total
    const totalPrice = cartItems.reduce((sum, item) => {
      return sum + parseFloat(item.final_unit_price) * item.quantity;
    }, 0);

    // 3. Create the order
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, customer_name, phone, address, notes, total_price, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [userId, customer_name, phone || null, address, notes || null, totalPrice.toFixed(2)]
    );

    const order = orderResult.rows[0];

   // 4. Copy cart items into order_items (snapshot name + price + customization details)
for (const item of cartItems) {
  await client.query(
    `
    INSERT INTO order_items
    (
      order_id,
      product_id,
      product_name,
      size,
      color,
      quantity,
      unit_price,
      is_customized,
      customization_label,
      chosen_color,
      chosen_size,
      custom_text,
      custom_note,
      design_label,
      collection_name,
      design_image_url
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `,
    [
      order.id,
      item.product_id,
      item.product_name,
      item.size || null,
      item.color || null,
      item.quantity,
      parseFloat(item.final_unit_price).toFixed(2),

      item.is_customized || false,
      item.customization_label || null,
      item.color || null,
      item.size || null,
      item.custom_text || null,
      item.custom_note || null,
      item.design_label || null,
      item.collection_name || null,
      item.design_image_url || null,
    ]
  );
}

    // 4.5 Reduce stock now that the order and its items were created successfully
    for (const [productId, requestedQuantity] of quantityByProduct.entries()) {
      await client.query(
        "UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2",
        [requestedQuantity, productId]
      );
    }

    // 5. Clear the user's cart
    await client.query("DELETE FROM cart_items WHERE user_id = $1", [userId]);

    await client.query("COMMIT");

    res.status(201).json({
      message: "Order placed successfully.",
      order,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Order creation error:", err);
    res.status(500).json({ error: "Failed to create order." });
  } finally {
    client.release();
  }
});

/* ─────────────────────────────────────────────
   GET /api/orders/my
   Logged-in user's own orders with their items.
───────────────────────────────────────────── */
router.get("/my", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    // Fetch orders
    const ordersResult = await pool.query(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    const orders = ordersResult.rows;

    if (orders.length === 0) {
      return res.json([]);
    }

    // Fetch all items for these orders in one query
    const orderIds = orders.map((o) => o.id);
    const itemsResult = await pool.query(
      `SELECT * FROM order_items WHERE order_id = ANY($1::int[]) ORDER BY id ASC`,
      [orderIds]
    );

    // Group items by order_id
    const itemsByOrder = {};
    for (const item of itemsResult.rows) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    }

    // Attach items to each order
    const ordersWithItems = orders.map((order) => ({
      ...order,
      items: itemsByOrder[order.id] || [],
    }));

    res.json(ordersWithItems);
  } catch (err) {
    console.error("Fetch my orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

/* ─────────────────────────────────────────────
   GET /api/orders
   Admin only — all orders with items.
───────────────────────────────────────────── */
router.get("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const ordersResult = await pool.query(
      `SELECT o.*, u.email AS user_email
       FROM orders o
       JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC`
    );

    const orders = ordersResult.rows;

    if (orders.length === 0) {
      return res.json([]);
    }

    const orderIds = orders.map((o) => o.id);
    const itemsResult = await pool.query(
      `SELECT * FROM order_items WHERE order_id = ANY($1::int[]) ORDER BY id ASC`,
      [orderIds]
    );

    const itemsByOrder = {};
    for (const item of itemsResult.rows) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    }

    const historyResult = await pool.query(
      `SELECT * FROM order_status_history WHERE order_id = ANY($1::int[]) ORDER BY created_at ASC`,
      [orderIds]
    );

    const historyByOrder = {};
    for (const entry of historyResult.rows) {
      if (!historyByOrder[entry.order_id]) historyByOrder[entry.order_id] = [];
      historyByOrder[entry.order_id].push(entry);
    }

    const ordersWithItems = orders.map((order) => ({
      ...order,
      items: itemsByOrder[order.id] || [],
      status_history: historyByOrder[order.id] || [],
    }));

    res.json(ordersWithItems);
  } catch (err) {
    console.error("Admin fetch orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

/* ─────────────────────────────────────────────
   PATCH /api/orders/:id/status
   Admin only — update order status.
   Body: { status: "pending"|"confirmed"|"delivered"|"cancelled" }
───────────────────────────────────────────── */
router.patch("/:id/status", authMiddleware, adminOnly, async (req, res) => {
  const orderId = parseInt(req.params.id);
  const { status } = req.body;

  const validStatuses = ["pending", "confirmed", "delivered", "cancelled"];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${validStatuses.join(", ")}`,
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the order row so a concurrent status change can't race the
    // stock_restored check below.
    const orderResult = await client.query(
      `SELECT id, status, stock_restored FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order not found." });
    }

    const currentOrder = orderResult.rows[0];

    const updateResult = await client.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, orderId]
    );

    let order = updateResult.rows[0];

    // Log the transition for the admin-facing status timeline. Skip if the
    // status didn't actually change (e.g. re-selecting the same value).
    if (currentOrder.status !== status) {
      await client.query(
        `INSERT INTO order_status_history (order_id, old_status, new_status)
         VALUES ($1, $2, $3)`,
        [orderId, currentOrder.status, status]
      );
    }

    // Restock only on the transition into cancelled, and only once ever
    // for this order — reverting to another status and cancelling again
    // must not restore stock a second time.
    if (status === "cancelled" && !currentOrder.stock_restored) {
      const itemsResult = await client.query(
        `SELECT product_id, quantity FROM order_items WHERE order_id = $1`,
        [orderId]
      );

      const quantityByProduct = new Map();
      for (const item of itemsResult.rows) {
        const current = quantityByProduct.get(item.product_id) || 0;
        quantityByProduct.set(
          item.product_id,
          current + Number(item.quantity || 0)
        );
      }

      for (const [productId, restoredQuantity] of quantityByProduct.entries()) {
        await client.query(
          `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2`,
          [restoredQuantity, productId]
        );
      }

      const flagResult = await client.query(
        `UPDATE orders SET stock_restored = true WHERE id = $1 RETURNING *`,
        [orderId]
      );
      order = flagResult.rows[0];
    }

    await client.query("COMMIT");

    res.json({ message: "Order status updated.", order });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update order status error:", err);
    res.status(500).json({ error: "Failed to update order status." });
  } finally {
    client.release();
  }
});

/* ─────────────────────────────────────────────
   PATCH /api/orders/:id/admin-notes
   Admin only — save internal notes for an order. Separate from the
   customer's own checkout `notes` field; never touches order status
   or stock.
   Body: { admin_notes: "text" }
───────────────────────────────────────────── */
router.patch("/:id/admin-notes", authMiddleware, adminOnly, async (req, res) => {
  const orderId = parseInt(req.params.id);
  const { admin_notes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE orders SET admin_notes = $1 WHERE id = $2 RETURNING *`,
      [admin_notes ?? null, orderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order not found." });
    }

    res.json({ message: "Admin notes updated", order: result.rows[0] });
  } catch (err) {
    console.error("Update admin notes error:", err);
    res.status(500).json({ error: "Failed to update admin notes." });
  }
});

module.exports = router;