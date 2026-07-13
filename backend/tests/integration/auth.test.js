// Task P1: authorization integration tests — real HTTP requests against
// the real Express app (via supertest), against TEST_DATABASE_URL only.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const { pool, resetDatabase } = require("./helpers/db");
const { createCustomer, createAdmin } = require("./helpers/auth");
const { createGeneralProduct } = require("./helpers/fixtures");

describe("Authorization", () => {
  before(async () => {
    await resetDatabase();
  });

  after(async () => {
    await pool.end();
  });

  test("unauthenticated request to a protected route is rejected (401)", async () => {
    const res = await request(app).get("/api/orders/my");
    assert.equal(res.status, 401);
  });

  test("customer can access a customer route (GET /api/orders/my)", async () => {
    const customer = await createCustomer();
    const res = await request(app)
      .get("/api/orders/my")
      .set("Authorization", customer.authHeader);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  test("customer receives 403 on an admin order-list route", async () => {
    const customer = await createCustomer();
    const res = await request(app)
      .get("/api/orders")
      .set("Authorization", customer.authHeader);
    assert.equal(res.status, 403);
  });

  test("customer receives 403 on an admin payment mutation route", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const product = await createGeneralProduct();

    // Need a real order to target — create one as the customer, then
    // attempt to mutate its payment as that same (non-admin) customer.
    await request(app)
      .post("/api/cart")
      .set("Authorization", customer.authHeader)
      .send({ product_id: product.id, quantity: 1 });
    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", customer.authHeader)
      .send({ customer_name: "Auth Test", address: "123 Test St" });
    assert.equal(orderRes.status, 201);
    const orderId = orderRes.body.order.id;

    const res = await request(app)
      .patch(`/api/orders/${orderId}/payment`)
      .set("Authorization", customer.authHeader)
      .send({ status: "PAID" });
    assert.equal(res.status, 403);

    // Admin token proves the route itself works, just not for a customer.
    const adminRes = await request(app)
      .patch(`/api/orders/${orderId}/payment`)
      .set("Authorization", admin.authHeader)
      .send({ status: "PAID", payment_method: "CASH_ON_DELIVERY" });
    assert.equal(adminRes.status, 200);
  });

  test("customer receives 403 on a fulfillment mutation route", async () => {
    const customer = await createCustomer();
    const product = await createGeneralProduct();
    await request(app)
      .post("/api/cart")
      .set("Authorization", customer.authHeader)
      .send({ product_id: product.id, quantity: 1 });
    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", customer.authHeader)
      .send({ customer_name: "Auth Test 2", address: "123 Test St" });
    const orderId = orderRes.body.order.id;

    const res = await request(app)
      .patch(`/api/orders/${orderId}/fulfillment`)
      .set("Authorization", customer.authHeader)
      .send({ carrier_name: "Sneaky Kargo" });
    assert.equal(res.status, 403);
  });

  test("admin can access an owner route (GET /api/orders)", async () => {
    const admin = await createAdmin();
    const res = await request(app).get("/api/orders").set("Authorization", admin.authHeader);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  test("an invalid/garbage token is rejected (401)", async () => {
    const res = await request(app)
      .get("/api/orders/my")
      .set("Authorization", "Bearer not-a-real-token");
    assert.equal(res.status, 401);
  });
});
