// Task P1: order production-workflow integration tests — full lifecycle,
// the ready-to-wear shortcut, invalid transitions, and history integrity.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { pool, resetDatabase } = require("./helpers/db");
const { createCustomer, createAdmin } = require("./helpers/auth");
const { createGeneralProduct, addGeneralToCart, placeOrder } = require("./helpers/fixtures");
const { patchOrderStatus, getOrderRow, getStatusHistory } = require("./helpers/workflow");

before(async () => {
  await resetDatabase();
});
after(async () => {
  await pool.end();
});

async function freshOrder(customer) {
  const product = await createGeneralProduct({ stock: 10 });
  await addGeneralToCart(customer, product.id, 1);
  const res = await placeOrder(customer);
  return res.body.order.id;
}

describe("Order workflow — full valid lifecycle", () => {
  test("new -> design_review -> in_production -> ready -> shipped -> delivered, one history row per transition", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const orderId = await freshOrder(customer);

    const path = ["design_review", "in_production", "ready", "shipped", "delivered"];
    for (const status of path) {
      // Ready -> Shipped requires fulfillment fields in the same request
      // (Task O1) — Pickup keeps this purely a status-workflow test, with
      // no carrier/tracking specifics (those are fulfillment.test.js's job).
      const body = status === "shipped" ? { status, shipping_method: "PICKUP" } : { status };
      const res = await patchOrderStatus(admin, orderId, body);
      assert.equal(res.status, 200, `transition to ${status} should succeed`);
      assert.equal(res.body.order.status, status);
    }

    const order = await getOrderRow(orderId);
    assert.equal(order.status, "delivered");

    const history = await getStatusHistory(orderId);
    assert.equal(history.length, 5, "exactly one history row per real transition");
    assert.deepEqual(
      history.map((h) => h.new_status),
      path
    );
  });
});

describe("Order workflow — ready-to-wear shortcut", () => {
  test("new -> in_production directly (skipping design_review) is allowed", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const orderId = await freshOrder(customer);

    const res = await patchOrderStatus(admin, orderId, { status: "in_production" });
    assert.equal(res.status, 200);

    const history = await getStatusHistory(orderId);
    assert.equal(history.length, 1);
    assert.equal(history[0].new_status, "in_production");
    assert.ok(!history.some((h) => h.new_status === "design_review"));
  });
});

describe("Order workflow — invalid transitions rejected", () => {
  test("new -> shipped is rejected, order status unchanged", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const orderId = await freshOrder(customer);

    const res = await patchOrderStatus(admin, orderId, { status: "shipped" });
    assert.equal(res.status, 400);

    const order = await getOrderRow(orderId);
    assert.equal(order.status, "new");
    const history = await getStatusHistory(orderId);
    assert.equal(history.length, 0);
  });

  test("delivered -> cancelled is rejected (final status)", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const orderId = await freshOrder(customer);
    for (const status of ["in_production", "ready", "shipped", "delivered"]) {
      const body = status === "shipped" ? { status, shipping_method: "PICKUP" } : { status };
      const stepRes = await patchOrderStatus(admin, orderId, body);
      assert.equal(stepRes.status, 200, `setup transition to ${status} should succeed`);
    }

    const res = await patchOrderStatus(admin, orderId, { status: "cancelled" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "This order has already reached a final status.");
  });
});

describe("Order workflow — idempotent same-status update", () => {
  test("re-selecting the same status creates no duplicate history row", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const orderId = await freshOrder(customer);

    await patchOrderStatus(admin, orderId, { status: "in_production" });
    const res = await patchOrderStatus(admin, orderId, { status: "in_production" });
    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Order status unchanged.");

    const history = await getStatusHistory(orderId);
    assert.equal(history.length, 1, "still exactly one history row");
  });
});
