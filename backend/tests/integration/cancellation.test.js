// Task P1: cancellation integration tests — General/Variant stock
// restoration, stock_restored guard, and the failed-cancellation guard.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { pool, resetDatabase } = require("./helpers/db");
const { createCustomer, createAdmin } = require("./helpers/auth");
const {
  createGeneralProduct,
  createVariantProduct,
  addGeneralToCart,
  addVariantToCart,
  placeOrder,
} = require("./helpers/fixtures");
const {
  patchOrderStatus,
  getOrderRow,
  getStatusHistory,
  getProductStock,
  getVariantStock,
} = require("./helpers/workflow");

before(async () => {
  await resetDatabase();
});
after(async () => {
  await pool.end();
});

describe("Cancellation — General inventory", () => {
  test("cancelling restores exact stock and sets stock_restored; repeated cancel does not double-restore", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const product = await createGeneralProduct({ stock: 10 });
    await addGeneralToCart(customer, product.id, 4);
    const orderRes = await placeOrder(customer);
    const orderId = orderRes.body.order.id;

    const stockAfterCheckout = await getProductStock(product.id);
    assert.equal(stockAfterCheckout, 6);

    const cancelRes = await patchOrderStatus(admin, orderId, { status: "cancelled" });
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.order.stock_restored, true);

    const stockAfterCancel = await getProductStock(product.id);
    assert.equal(stockAfterCancel, 10, "exact stock restored");

    // Idempotent re-cancel must not restore a second time.
    const secondCancelRes = await patchOrderStatus(admin, orderId, { status: "cancelled" });
    assert.equal(secondCancelRes.status, 200);
    assert.equal(secondCancelRes.body.message, "Order status unchanged.");

    const stockAfterSecondCancel = await getProductStock(product.id);
    assert.equal(stockAfterSecondCancel, 10, "no double restoration");
  });
});

describe("Cancellation — Variant inventory", () => {
  test("cancelling restores the exact variant; an unrelated variant on the same product is unchanged", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { product, color, size, variant } = await createVariantProduct({ stock: 10 });

    // A second, unrelated color/size on the SAME product — must never move.
    const otherColor = await pool.query(
      "INSERT INTO customizable_product_colors (product_id, color_name, is_active) VALUES ($1, 'OtherColor', true) RETURNING *",
      [product.id]
    );
    const otherVariant = await pool.query(
      "INSERT INTO product_inventory_variants (product_id, color_id, size_id, stock_quantity) VALUES ($1, $2, $3, 7) RETURNING *",
      [product.id, otherColor.rows[0].id, size.id]
    );

    await addVariantToCart(customer, product.id, color.color_name, size.size_label, 3);
    const orderRes = await placeOrder(customer);
    const orderId = orderRes.body.order.id;

    assert.equal(await getVariantStock(variant.id), 7);

    const cancelRes = await patchOrderStatus(admin, orderId, { status: "cancelled" });
    assert.equal(cancelRes.status, 200);

    assert.equal(await getVariantStock(variant.id), 10, "exact variant restored");
    assert.equal(
      await getVariantStock(otherVariant.rows[0].id),
      7,
      "unrelated variant on the same product is unchanged"
    );
  });
});

describe("Cancellation — failed cancellation guard", () => {
  test("cancellation blocked when the underlying product no longer exists: status/history/stock all unchanged", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const product = await createGeneralProduct({ stock: 5 });
    await addGeneralToCart(customer, product.id, 2);
    const orderRes = await placeOrder(customer);
    const orderId = orderRes.body.order.id;

    // order_items.product_id -> ON DELETE SET NULL; simulates the product
    // being deleted between checkout and a later cancellation attempt.
    await pool.query("DELETE FROM products WHERE id = $1", [product.id]);

    const cancelRes = await patchOrderStatus(admin, orderId, { status: "cancelled" });
    assert.equal(cancelRes.status, 400);

    const order = await getOrderRow(orderId);
    assert.equal(order.status, "new", "status unchanged");
    assert.equal(order.stock_restored, false);

    const history = await getStatusHistory(orderId);
    assert.equal(history.length, 0, "no history row written");
  });
});
