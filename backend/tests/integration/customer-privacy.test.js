// Task P1: customer-privacy integration tests — GET /api/orders/my must
// never leak private/internal fields, and must expose exactly the
// documented customer-safe fields.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const { pool, resetDatabase } = require("./helpers/db");
const { createCustomer, createAdmin } = require("./helpers/auth");
const { createGeneralProduct, addGeneralToCart, placeOrder, unique } = require("./helpers/fixtures");
const { patchOrderStatus, patchPayment, patchFulfillment, advanceToReady } = require("./helpers/workflow");

before(async () => {
  await resetDatabase();
});
after(async () => {
  await pool.end();
});

describe("Customer privacy — GET /api/orders/my", () => {
  test("a fully-worked order (paid, shipped, with private notes) exposes no private/internal fields", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const product = await createGeneralProduct({ stock: 10 });
    await addGeneralToCart(customer, product.id, 1);
    const orderRes = await placeOrder(customer);
    const orderId = orderRes.body.order.id;

    // Save a legacy-style admin note (orders.admin_notes) and a private
    // fulfillment/payment note — all of these must never reach the customer.
    await request(app)
      .patch(`/api/orders/${orderId}/admin-notes`)
      .set("Authorization", admin.authHeader)
      .send({ admin_notes: "Customer called about delivery timing." });

    await advanceToReady(admin, orderId);
    const trackingNumber = unique("TRK");
    await patchOrderStatus(admin, orderId, {
      status: "shipped",
      shipping_method: "COURIER",
      carrier_name: "Aras Kargo",
      tracking_number: trackingNumber,
      tracking_url: "https://track.example.com/x",
      private_note: "Fragile — handle with care.",
    });
    await patchPayment(admin, orderId, {
      status: "PAID",
      payment_method: "BANK_TRANSFER",
      transaction_reference: unique("TRX"),
      change_note: "Confirmed via bank statement.",
    });

    const myOrdersRes = await request(app)
      .get("/api/orders/my")
      .set("Authorization", customer.authHeader);
    assert.equal(myOrdersRes.status, 200);
    const order = myOrdersRes.body.find((o) => o.id === orderId);
    assert.ok(order, "customer can see their own order");

    const forbiddenKeys = [
      "admin_notes",
      "private_note",
      "fulfillment_private_note",
      "change_note",
      "refund_reason",
      "failure_reason",
      "updated_by",
      "fulfillment_updated_by_email",
      "fulfillment_id",
      "payment_id",
      "payment_history",
      "status_history",
      "tracking_unavailable",
    ];
    for (const key of forbiddenKeys) {
      assert.equal(key in order, false, `customer response must not contain "${key}"`);
    }

    // Belt-and-suspenders: none of the actual private text leaked anywhere
    // in the payload, even under a different field name.
    const raw = JSON.stringify(order);
    assert.doesNotMatch(raw, /Customer called about delivery timing/);
    assert.doesNotMatch(raw, /Fragile — handle with care/);
    assert.doesNotMatch(raw, /Confirmed via bank statement/);

    // Positive assertions: the documented safe fields ARE present and correct.
    assert.ok(Array.isArray(order.status_timeline));
    assert.equal(order.payment_status, "PAID");
    assert.equal(order.payment_method, "BANK_TRANSFER");
    assert.ok(order.safe_transaction_reference);
    assert.equal(order.shipping_method, "COURIER");
    assert.equal(order.carrier_name, "Aras Kargo");
    assert.equal(order.tracking_number, trackingNumber);
    assert.equal(order.safe_tracking_url, "https://track.example.com/x");
    assert.equal(order.tracking_status, null, "not applicable — a real tracking number exists");
    assert.ok(order.shipped_at);
  });

  test("a pending order never shows shipping/tracking details even if the owner pre-filled them", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const product = await createGeneralProduct({ stock: 5 });
    await addGeneralToCart(customer, product.id, 1);
    const orderRes = await placeOrder(customer);
    const orderId = orderRes.body.order.id;

    // Owner pre-fills fulfillment info while the order is still brand new.
    await patchFulfillment(admin, orderId, { shipping_method: "COURIER", carrier_name: "Pre-filled" });

    const myOrdersRes = await request(app)
      .get("/api/orders/my")
      .set("Authorization", customer.authHeader);
    const order = myOrdersRes.body.find((o) => o.id === orderId);

    assert.equal(order.shipping_method, null);
    assert.equal(order.carrier_name, null);
    assert.equal(order.safe_tracking_url, null);
    assert.equal(order.tracking_status, null);
  });
});
