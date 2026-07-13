// Task P1: checkout integration tests — General inventory, Variant
// inventory, out-of-stock protection, and atomicity, against
// TEST_DATABASE_URL only. One shared pool/process per file (node:test's
// default), so the pool is reset once at file start and closed once at
// file end — never per-describe, since every describe below shares it.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const { pool, resetDatabase } = require("./helpers/db");
const { createCustomer } = require("./helpers/auth");
const {
  createGeneralProduct,
  createVariantProduct,
  addGeneralToCart,
  addVariantToCart,
  placeOrder,
} = require("./helpers/fixtures");
const { getPaymentRow, getFulfillmentRow, getProductStock, getVariantStock, getCartCount } = require("./helpers/workflow");

before(async () => {
  await resetDatabase();
});

after(async () => {
  await pool.end();
});

describe("Checkout — General inventory", () => {
  test("checkout succeeds: order/payment/fulfillment created, stock deducted once, cart cleared", async () => {
    const customer = await createCustomer();
    const product = await createGeneralProduct({ stock: 10 });

    const cartRes = await addGeneralToCart(customer, product.id, 3);
    assert.equal(cartRes.status, 201);

    const orderRes = await placeOrder(customer);
    assert.equal(orderRes.status, 201);
    const orderId = orderRes.body.order.id;
    assert.equal(orderRes.body.order.status, "new");

    const payment = await getPaymentRow(orderId);
    assert.ok(payment, "payment row was created");
    assert.equal(payment.status, "PENDING");
    assert.equal(payment.payment_method, "MANUAL");

    const fulfillment = await getFulfillmentRow(orderId);
    assert.ok(fulfillment, "fulfillment row was created");
    assert.equal(fulfillment.shipping_method, null);

    const stockAfter = await getProductStock(product.id);
    assert.equal(stockAfter, 7, "stock deducted by exactly 3, exactly once");

    const cartCount = await getCartCount(customer.user.id);
    assert.equal(cartCount, 0, "cart cleared after commit");
  });
});

describe("Checkout — Variant inventory", () => {
  test("checkout deducts the exact color/size combination, not products.stock_quantity", async () => {
    const customer = await createCustomer();
    const { product, color, size, variant } = await createVariantProduct({ stock: 15 });

    const cartRes = await addVariantToCart(customer, product.id, color.color_name, size.size_label, 4);
    assert.equal(cartRes.status, 201);

    const orderRes = await placeOrder(customer);
    assert.equal(orderRes.status, 201);
    const orderId = orderRes.body.order.id;

    const variantStockAfter = await getVariantStock(variant.id);
    assert.equal(variantStockAfter, 11, "exact variant deducted by 4");

    const generalStockAfter = await getProductStock(product.id);
    assert.equal(generalStockAfter, 0, "products.stock_quantity untouched (VARIANT product never uses it)");

    const payment = await getPaymentRow(orderId);
    assert.ok(payment && payment.status === "PENDING");
    const fulfillment = await getFulfillmentRow(orderId);
    assert.ok(fulfillment);

    const cartCount = await getCartCount(customer.user.id);
    assert.equal(cartCount, 0);
  });
});

describe("Out-of-stock protection", () => {
  // cart.routes.js already rejects an add-to-cart request that immediately
  // exceeds stock, so a same-request over-quantity never reaches checkout
  // at all. The scenario checkout's own stock re-validation actually
  // guards against is stock changing *after* the item was added to cart
  // (a concurrent sale, or the owner adjusting stock) — reproduced here by
  // adding while stock is sufficient, then reducing it directly, mirroring
  // "nothing about Add-to-Cart validation is trusted again at checkout."
  test("General stock that drops below cart quantity before checkout is rejected with no side effects", async () => {
    const customer = await createCustomer();
    const product = await createGeneralProduct({ stock: 5 });

    const cartRes = await addGeneralToCart(customer, product.id, 3);
    assert.equal(cartRes.status, 201);

    await pool.query("UPDATE products SET stock_quantity = 1 WHERE id = $1", [product.id]);

    const orderRes = await placeOrder(customer);
    assert.equal(orderRes.status, 400);

    const ordersResult = await pool.query("SELECT * FROM orders WHERE user_id = $1", [customer.user.id]);
    assert.equal(ordersResult.rows.length, 0, "no order created");

    const paymentsResult = await pool.query(
      "SELECT p.* FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.user_id = $1",
      [customer.user.id]
    );
    assert.equal(paymentsResult.rows.length, 0, "no payment created");

    const stockAfter = await getProductStock(product.id);
    assert.equal(stockAfter, 1, "no partial stock deduction");

    const cartCount = await getCartCount(customer.user.id);
    assert.equal(cartCount, 1, "cart preserved");
  });

  test("Variant stock that drops below cart quantity before checkout is rejected with no side effects", async () => {
    const customer = await createCustomer();
    const { product, color, size, variant } = await createVariantProduct({ stock: 5 });

    const cartRes = await addVariantToCart(customer, product.id, color.color_name, size.size_label, 3);
    assert.equal(cartRes.status, 201);

    await pool.query("UPDATE product_inventory_variants SET stock_quantity = 1 WHERE id = $1", [variant.id]);

    const orderRes = await placeOrder(customer);
    assert.equal(orderRes.status, 400);

    const ordersResult = await pool.query("SELECT * FROM orders WHERE user_id = $1", [customer.user.id]);
    assert.equal(ordersResult.rows.length, 0);

    const variantStockAfter = await getVariantStock(variant.id);
    assert.equal(variantStockAfter, 1, "no partial variant stock deduction");

    const cartCount = await getCartCount(customer.user.id);
    assert.equal(cartCount, 1, "cart preserved");
  });
});

describe("Checkout atomicity — forced failure mid-transaction", () => {
  test("a forced payment-insert failure rolls back the entire checkout", async (t) => {
    const customer = await createCustomer();
    const product = await createGeneralProduct({ stock: 10 });
    await addGeneralToCart(customer, product.id, 2);

    // Clean test mechanism per Task P1: a temporary DB constraint, added
    // and removed around this single test, forces the payments INSERT
    // (which checkout always performs with payment_method='MANUAL') to
    // fail — no production code is touched.
    // NOT VALID skips checking pre-existing rows (earlier tests in this
    // same file already left MANUAL payments behind) while still fully
    // enforcing the constraint against any new INSERT — exactly the one
    // this test needs to force.
    await pool.query(
      "ALTER TABLE payments ADD CONSTRAINT p1_force_payment_fail CHECK (payment_method <> 'MANUAL') NOT VALID"
    );
    t.after(async () => {
      await pool.query("ALTER TABLE payments DROP CONSTRAINT IF EXISTS p1_force_payment_fail");
    });

    const orderRes = await placeOrder(customer);
    assert.equal(orderRes.status, 500);

    const ordersResult = await pool.query("SELECT * FROM orders WHERE user_id = $1", [customer.user.id]);
    assert.equal(ordersResult.rows.length, 0, "no order remains");

    const itemsResult = await pool.query(
      "SELECT oi.* FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.user_id = $1",
      [customer.user.id]
    );
    assert.equal(itemsResult.rows.length, 0, "no order items remain");

    const paymentsResult = await pool.query(
      "SELECT p.* FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.user_id = $1",
      [customer.user.id]
    );
    assert.equal(paymentsResult.rows.length, 0, "no payment remains");

    const stockAfter = await getProductStock(product.id);
    assert.equal(stockAfter, 10, "stock unchanged");

    const cartCount = await getCartCount(customer.user.id);
    assert.equal(cartCount, 1, "cart remains");
  });

  test("a forced fulfillment-insert failure also rolls back the entire checkout", async (t) => {
    const customer = await createCustomer();
    const product = await createGeneralProduct({ stock: 10 });
    await addGeneralToCart(customer, product.id, 2);

    await pool.query(
      "ALTER TABLE order_fulfillment ADD CONSTRAINT p1_force_fulfillment_fail CHECK (shipping_method IS NOT NULL) NOT VALID"
    );
    t.after(async () => {
      await pool.query("ALTER TABLE order_fulfillment DROP CONSTRAINT IF EXISTS p1_force_fulfillment_fail");
    });

    const orderRes = await placeOrder(customer);
    assert.equal(orderRes.status, 500);

    const ordersResult = await pool.query("SELECT * FROM orders WHERE user_id = $1", [customer.user.id]);
    assert.equal(ordersResult.rows.length, 0, "no order remains");

    const paymentsResult = await pool.query(
      "SELECT p.* FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.user_id = $1",
      [customer.user.id]
    );
    assert.equal(paymentsResult.rows.length, 0, "no payment remains either — same transaction");

    const stockAfter = await getProductStock(product.id);
    assert.equal(stockAfter, 10, "stock unchanged");

    const cartCount = await getCartCount(customer.user.id);
    assert.equal(cartCount, 1, "cart remains");
  });
});
