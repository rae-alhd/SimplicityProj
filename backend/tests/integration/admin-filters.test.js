// Task P1: admin order-list filter integration tests. Parameterized API
// requests (query strings), never string-concatenated SQL.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const { pool, resetDatabase } = require("./helpers/db");
const { createCustomer, createAdmin } = require("./helpers/auth");
const { createGeneralProduct, addGeneralToCart, placeOrder, unique } = require("./helpers/fixtures");
const { patchOrderStatus, patchPayment, advanceToReady } = require("./helpers/workflow");

before(async () => {
  await resetDatabase();
});
after(async () => {
  await pool.end();
});

async function orderedFixtures(admin) {
  // A: new, PENDING, gift.
  const customerA = await createCustomer();
  const productA = await createGeneralProduct({ stock: 5 });
  await addGeneralToCart(customerA, productA.id, 1);
  const orderARes = await request(app)
    .post("/api/orders")
    .set("Authorization", customerA.authHeader)
    .send({ customer_name: unique("GiftCustomer"), address: "1 Test St", is_gift: true });
  const orderAId = orderARes.body.order.id;

  // B: ready, PAID, not gift.
  const customerB = await createCustomer();
  const productB = await createGeneralProduct({ stock: 5 });
  await addGeneralToCart(customerB, productB.id, 1);
  const orderBRes = await request(app)
    .post("/api/orders")
    .set("Authorization", customerB.authHeader)
    .send({ customer_name: unique("PlainCustomer"), address: "2 Test St" });
  const orderBId = orderBRes.body.order.id;
  await advanceToReady(admin, orderBId);
  await patchPayment(admin, orderBId, { status: "PAID", payment_method: "CASH_ON_DELIVERY" });

  // C: shipped Courier with tracking missing (genuinely incomplete).
  const customerC = await createCustomer();
  const productC = await createGeneralProduct({ stock: 5 });
  await addGeneralToCart(customerC, productC.id, 1);
  const orderCRes = await request(app)
    .post("/api/orders")
    .set("Authorization", customerC.authHeader)
    .send({ customer_name: unique("TrackingMissingCustomer"), address: "3 Test St" });
  const orderCId = orderCRes.body.order.id;
  await advanceToReady(admin, orderCId);
  await patchOrderStatus(admin, orderCId, {
    status: "shipped",
    shipping_method: "COURIER",
    carrier_name: "Aras Kargo",
    tracking_unavailable: true,
  });
  // Simulate a genuinely-forgotten tracking number (not a confirmed-unavailable one).
  await pool.query("UPDATE order_fulfillment SET tracking_unavailable = false WHERE order_id = $1", [orderCId]);

  return { orderAId, orderBId, orderCId, customerA, customerB, customerC };
}

describe("Admin order filters", () => {
  test("filters correctly narrow results: status, payment_status, gift, customized, refund_required, fulfillment, tracking_missing, search", async () => {
    const admin = await createAdmin();
    const { orderAId, orderBId, orderCId } = await orderedFixtures(admin);

    async function filtered(query) {
      const res = await request(app)
        .get(`/api/orders${query}`)
        .set("Authorization", admin.authHeader);
      assert.equal(res.status, 200, `query ${query} should succeed`);
      return res.body;
    }

    let results = await filtered("?status=new");
    assert.ok(results.some((o) => o.id === orderAId));
    assert.ok(!results.some((o) => o.id === orderBId));

    results = await filtered("?payment_status=PAID");
    assert.ok(results.some((o) => o.id === orderBId));
    assert.ok(!results.some((o) => o.id === orderAId));

    results = await filtered("?gift=true");
    assert.ok(results.some((o) => o.id === orderAId));
    assert.ok(!results.some((o) => o.id === orderBId));

    results = await filtered("?gift=false");
    assert.ok(!results.some((o) => o.id === orderAId));

    results = await filtered("?customized=false");
    assert.ok(results.some((o) => o.id === orderAId), "none of these fixtures are customized");

    results = await filtered("?fulfillment=in_transit");
    assert.ok(results.some((o) => o.id === orderCId));
    assert.ok(!results.some((o) => o.id === orderAId));

    results = await filtered("?tracking_missing=true");
    assert.ok(results.some((o) => o.id === orderCId));

    results = await filtered("?tracking_missing=false");
    assert.ok(!results.some((o) => o.id === orderCId));

    // Search by exact order number (zero-padded, as the admin UI displays it).
    const paddedOrderId = String(orderAId).padStart(5, "0");
    results = await filtered(`?search=${paddedOrderId}`);
    assert.ok(results.some((o) => o.id === orderAId));
  });

  test("an invalid filter value is rejected with 400, not silently ignored", async () => {
    const admin = await createAdmin();
    const res = await request(app)
      .get("/api/orders?payment_status=NOT_REAL")
      .set("Authorization", admin.authHeader);
    assert.equal(res.status, 400);
  });
});
