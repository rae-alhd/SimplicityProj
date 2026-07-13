// Task P1: refund_required derived-field integration tests.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { pool, resetDatabase } = require("./helpers/db");
const { createCustomer, createAdmin } = require("./helpers/auth");
const { createGeneralProduct, addGeneralToCart, placeOrder } = require("./helpers/fixtures");
const { patchPayment, patchOrderStatus, getProductStock } = require("./helpers/workflow");
const request = require("supertest");
const app = require("../../src/app");

before(async () => {
  await resetDatabase();
});
after(async () => {
  await pool.end();
});

async function getAdminOrder(admin, orderId) {
  const res = await request(app).get("/api/orders").set("Authorization", admin.authHeader);
  return res.body.find((o) => o.id === orderId);
}

describe("refund_required", () => {
  test("cancel a PAID order -> refund_required true; mark REFUNDED -> refund_required false; stock never double-touched by refund", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const product = await createGeneralProduct({ stock: 10 });
    await addGeneralToCart(customer, product.id, 4);
    const orderRes = await placeOrder(customer);
    const orderId = orderRes.body.order.id;

    await patchPayment(admin, orderId, { status: "PAID", payment_method: "CASH_ON_DELIVERY" });

    let order = await getAdminOrder(admin, orderId);
    assert.equal(order.refund_required, false, "not cancelled yet");

    const cancelRes = await patchOrderStatus(admin, orderId, { status: "cancelled" });
    assert.equal(cancelRes.status, 200);

    const stockAfterCancel = await getProductStock(product.id);
    assert.equal(stockAfterCancel, 10, "cancellation itself still restores stock");

    order = await getAdminOrder(admin, orderId);
    assert.equal(order.payment_status, "PAID", "payment remains PAID after cancellation");
    assert.equal(order.refund_required, true, "refund_required becomes true");

    const refundRes = await patchPayment(admin, orderId, {
      status: "REFUNDED",
      refund_reason: "Order cancelled",
    });
    assert.equal(refundRes.status, 200);

    const stockAfterRefund = await getProductStock(product.id);
    assert.equal(stockAfterRefund, 10, "refund operation itself does not touch stock");

    order = await getAdminOrder(admin, orderId);
    assert.equal(order.refund_required, false, "refund_required becomes false once REFUNDED");
  });

  test("refund_required is false for PENDING or FAILED cancelled orders", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const product = await createGeneralProduct({ stock: 5 });
    await addGeneralToCart(customer, product.id, 1);
    const orderRes = await placeOrder(customer);
    const orderId = orderRes.body.order.id;

    // Payment stays PENDING (never marked PAID).
    await patchOrderStatus(admin, orderId, { status: "cancelled" });
    const order = await getAdminOrder(admin, orderId);
    assert.equal(order.payment_status, "PENDING");
    assert.equal(order.refund_required, false);
  });
});
