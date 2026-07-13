// Task P1: small helpers for driving an order through its production
// workflow and reading back history/stock during integration tests.
const request = require("supertest");
const app = require("../../../src/app");
const { pool } = require("./db");

async function patchOrderStatus(admin, orderId, body) {
  return request(app)
    .patch(`/api/orders/${orderId}/status`)
    .set("Authorization", admin.authHeader)
    .send(body);
}

async function patchPayment(admin, orderId, body) {
  return request(app)
    .patch(`/api/orders/${orderId}/payment`)
    .set("Authorization", admin.authHeader)
    .send(body);
}

async function patchFulfillment(admin, orderId, body) {
  return request(app)
    .patch(`/api/orders/${orderId}/fulfillment`)
    .set("Authorization", admin.authHeader)
    .send(body);
}

// Advances a fresh 'new' order all the way to 'ready' via the shortest
// valid path (new -> in_production -> ready), matching the ready-to-wear
// shortcut this project's own workflow explicitly allows.
async function advanceToReady(admin, orderId) {
  await patchOrderStatus(admin, orderId, { status: "in_production" });
  await patchOrderStatus(admin, orderId, { status: "ready" });
}

async function getOrderRow(orderId) {
  const result = await pool.query("SELECT * FROM orders WHERE id = $1", [orderId]);
  return result.rows[0] || null;
}

async function getPaymentRow(orderId) {
  const result = await pool.query("SELECT * FROM payments WHERE order_id = $1", [orderId]);
  return result.rows[0] || null;
}

async function getFulfillmentRow(orderId) {
  const result = await pool.query("SELECT * FROM order_fulfillment WHERE order_id = $1", [orderId]);
  return result.rows[0] || null;
}

async function getStatusHistory(orderId) {
  const result = await pool.query(
    "SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC",
    [orderId]
  );
  return result.rows;
}

async function getPaymentHistory(orderId) {
  const result = await pool.query(
    "SELECT * FROM payment_status_history WHERE order_id = $1 ORDER BY created_at ASC",
    [orderId]
  );
  return result.rows;
}

async function getProductStock(productId) {
  const result = await pool.query("SELECT stock_quantity FROM products WHERE id = $1", [productId]);
  return result.rows.length ? Number(result.rows[0].stock_quantity) : null;
}

async function getVariantStock(variantId) {
  const result = await pool.query(
    "SELECT stock_quantity FROM product_inventory_variants WHERE id = $1",
    [variantId]
  );
  return result.rows.length ? Number(result.rows[0].stock_quantity) : null;
}

async function getCartCount(userId) {
  const result = await pool.query("SELECT COUNT(*) FROM cart_items WHERE user_id = $1", [userId]);
  return Number(result.rows[0].count);
}

module.exports = {
  patchOrderStatus,
  patchPayment,
  patchFulfillment,
  advanceToReady,
  getOrderRow,
  getPaymentRow,
  getFulfillmentRow,
  getStatusHistory,
  getPaymentHistory,
  getProductStock,
  getVariantStock,
  getCartCount,
};
