// Task P1: shipping & fulfillment integration tests.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { pool, resetDatabase } = require("./helpers/db");
const { createCustomer, createAdmin } = require("./helpers/auth");
const { createGeneralProduct, addGeneralToCart, placeOrder, unique } = require("./helpers/fixtures");
const {
  patchOrderStatus,
  patchFulfillment,
  advanceToReady,
  getFulfillmentRow,
  getStatusHistory,
  getPaymentRow,
  getOrderRow,
} = require("./helpers/workflow");

before(async () => {
  await resetDatabase();
});
after(async () => {
  await pool.end();
});

async function readyOrder(customer, admin) {
  const product = await createGeneralProduct({ stock: 10 });
  await addGeneralToCart(customer, product.id, 1);
  const orderRes = await placeOrder(customer);
  const orderId = orderRes.body.order.id;
  await advanceToReady(admin, orderId);
  return { orderId, product };
}

describe("Fulfillment — Ready -> Shipped requirements", () => {
  test("Courier without carrier is rejected, no order/history/fulfillment change", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { orderId } = await readyOrder(customer, admin);

    const res = await patchOrderStatus(admin, orderId, {
      status: "shipped",
      shipping_method: "COURIER",
      tracking_number: unique("TRK"),
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /carrier_name is required/);

    const order = await getOrderRow(orderId);
    assert.equal(order.status, "ready");
    assert.equal((await getStatusHistory(orderId)).length, 2, "still just new->in_production, in_production->ready");
    const fulfillment = await getFulfillmentRow(orderId);
    assert.equal(fulfillment.shipping_method, null);
  });

  test("Courier without tracking_number or unavailable confirmation is rejected", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { orderId } = await readyOrder(customer, admin);

    const res = await patchOrderStatus(admin, orderId, {
      status: "shipped",
      shipping_method: "COURIER",
      carrier_name: "Aras Kargo",
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /tracking_number is required/);
  });

  test("Courier with a tracking number succeeds; shipped_at is server-generated; one history row", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { orderId } = await readyOrder(customer, admin);
    const trackingNumber = unique("TRK");

    const res = await patchOrderStatus(admin, orderId, {
      status: "shipped",
      shipping_method: "COURIER",
      carrier_name: "Aras Kargo",
      tracking_number: trackingNumber,
    });
    assert.equal(res.status, 200);

    const fulfillment = await getFulfillmentRow(orderId);
    assert.equal(fulfillment.tracking_number, trackingNumber);
    assert.ok(fulfillment.shipped_at, "shipped_at set by server");
    assert.equal((await getStatusHistory(orderId)).length, 3);
  });

  test("Courier with tracking_unavailable=true succeeds without a tracking number", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { orderId } = await readyOrder(customer, admin);

    const res = await patchOrderStatus(admin, orderId, {
      status: "shipped",
      shipping_method: "COURIER",
      carrier_name: "MNG Kargo",
      tracking_unavailable: true,
    });
    assert.equal(res.status, 200);
    const fulfillment = await getFulfillmentRow(orderId);
    assert.equal(fulfillment.tracking_number, null);
    assert.equal(fulfillment.tracking_unavailable, true);
  });

  test("Pickup succeeds without carrier or tracking", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { orderId } = await readyOrder(customer, admin);

    const res = await patchOrderStatus(admin, orderId, { status: "shipped", shipping_method: "PICKUP" });
    assert.equal(res.status, 200);
    const fulfillment = await getFulfillmentRow(orderId);
    assert.equal(fulfillment.carrier_name, null);
    assert.equal(fulfillment.tracking_number, null);
    assert.ok(fulfillment.shipped_at);
  });
});

describe("Fulfillment — tracking URL validation at the transition boundary", () => {
  test("a javascript: tracking_url is rejected on the Ready -> Shipped transition", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { orderId } = await readyOrder(customer, admin);

    const res = await patchOrderStatus(admin, orderId, {
      status: "shipped",
      shipping_method: "PICKUP",
      tracking_url: "javascript:alert(1)",
    });
    assert.equal(res.status, 400);
  });
});

describe("Fulfillment — Shipped -> Delivered", () => {
  test("delivered_at is server-generated; exactly one additional history row", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { orderId } = await readyOrder(customer, admin);
    await patchOrderStatus(admin, orderId, { status: "shipped", shipping_method: "PICKUP" });

    const res = await patchOrderStatus(admin, orderId, { status: "delivered" });
    assert.equal(res.status, 200);
    const fulfillment = await getFulfillmentRow(orderId);
    assert.ok(fulfillment.delivered_at);
    assert.equal((await getStatusHistory(orderId)).length, 4);
  });
});

describe("Fulfillment — corrections and the shipped-Courier invariant", () => {
  test("entering a tracking number clears tracking_unavailable", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { orderId } = await readyOrder(customer, admin);
    await patchOrderStatus(admin, orderId, {
      status: "shipped",
      shipping_method: "COURIER",
      carrier_name: "PTT Kargo",
      tracking_unavailable: true,
    });

    const res = await patchFulfillment(admin, orderId, { tracking_number: unique("TRK") });
    assert.equal(res.status, 200);
    assert.equal(res.body.fulfillment.tracking_unavailable, false);
  });

  test("a Shipped Courier order cannot be left with neither a tracking number nor a confirmation", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { orderId } = await readyOrder(customer, admin);
    await patchOrderStatus(admin, orderId, {
      status: "shipped",
      shipping_method: "COURIER",
      carrier_name: "Yurtici Kargo",
      tracking_number: unique("TRK"),
    });

    const res = await patchFulfillment(admin, orderId, { tracking_number: "" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /tracking number or be marked as tracking unavailable/);
  });

  test("fulfillment edits do not alter payment status, stock, or order total", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { orderId, product } = await readyOrder(customer, admin);
    await patchOrderStatus(admin, orderId, {
      status: "shipped",
      shipping_method: "COURIER",
      carrier_name: "Aras Kargo",
      tracking_number: unique("TRK"),
    });

    const paymentBefore = await getPaymentRow(orderId);
    const orderBefore = await getOrderRow(orderId);
    const stockResultBefore = await pool.query("SELECT stock_quantity FROM products WHERE id = $1", [product.id]);

    const res = await patchFulfillment(admin, orderId, { carrier_name: "Corrected Carrier" });
    assert.equal(res.status, 200);

    const paymentAfter = await getPaymentRow(orderId);
    const orderAfter = await getOrderRow(orderId);
    const stockResultAfter = await pool.query("SELECT stock_quantity FROM products WHERE id = $1", [product.id]);

    assert.equal(paymentAfter.status, paymentBefore.status);
    assert.equal(orderAfter.status, orderBefore.status);
    assert.equal(Number(orderAfter.total_price), Number(orderBefore.total_price));
    assert.equal(stockResultAfter.rows[0].stock_quantity, stockResultBefore.rows[0].stock_quantity);
  });
});
