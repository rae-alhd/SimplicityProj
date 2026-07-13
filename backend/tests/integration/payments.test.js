// Task P1: payment lifecycle integration tests.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { pool, resetDatabase } = require("./helpers/db");
const { createCustomer, createAdmin } = require("./helpers/auth");
const { createGeneralProduct, addGeneralToCart, placeOrder, unique } = require("./helpers/fixtures");
const { patchPayment, getOrderRow, getPaymentRow, getPaymentHistory, getProductStock } = require("./helpers/workflow");

before(async () => {
  await resetDatabase();
});
after(async () => {
  await pool.end();
});

async function freshOrder(customer, stock = 10, qty = 2) {
  const product = await createGeneralProduct({ stock });
  await addGeneralToCart(customer, product.id, qty);
  const res = await placeOrder(customer);
  return { orderId: res.body.order.id, product };
}

describe("Payments — transitions", () => {
  test("PENDING -> PAID -> REFUNDED, with FAILED/PENDING retry in between, exactly one history row per real change", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { orderId } = await freshOrder(customer);

    let res = await patchPayment(admin, orderId, {
      status: "FAILED",
      failure_reason: "Card declined (test)",
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.payment.failed_at);

    res = await patchPayment(admin, orderId, { status: "PENDING" });
    assert.equal(res.status, 200);
    assert.equal(res.body.payment.failed_at, null, "failed_at cleared on retry to PENDING");

    res = await patchPayment(admin, orderId, { status: "PAID", payment_method: "CASH_ON_DELIVERY" });
    assert.equal(res.status, 200);
    assert.ok(res.body.payment.paid_at, "paid_at is server-generated");
    const firstPaidAt = res.body.payment.paid_at;

    // Idempotent re-select must not change paid_at or add history.
    res = await patchPayment(admin, orderId, { status: "PAID" });
    assert.equal(res.body.message, "Payment status unchanged.");
    assert.equal(res.body.payment.paid_at, firstPaidAt);

    res = await patchPayment(admin, orderId, {
      status: "REFUNDED",
      refund_reason: "Customer requested",
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.payment.refunded_at, "refunded_at is server-generated");

    const history = await getPaymentHistory(orderId);
    assert.equal(history.length, 4, "FAILED, PENDING, PAID, REFUNDED — 4 real transitions, idempotent excluded");
  });

  test("invalid transitions are rejected: PENDING->REFUNDED, REFUNDED->PAID, REFUNDED->PENDING", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { orderId } = await freshOrder(customer);

    let res = await patchPayment(admin, orderId, { status: "REFUNDED", refund_reason: "n/a" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "This payment must be marked as Paid before it can be refunded.");

    await patchPayment(admin, orderId, { status: "PAID", payment_method: "CASH_ON_DELIVERY" });
    await patchPayment(admin, orderId, { status: "REFUNDED", refund_reason: "n/a" });

    res = await patchPayment(admin, orderId, { status: "PAID" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "This payment cannot move from Refunded back to Paid.");

    res = await patchPayment(admin, orderId, { status: "PENDING" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "This payment has already been refunded.");
  });

  test("payment changes never alter order status or product stock", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { orderId, product } = await freshOrder(customer, 10, 3);

    const stockBefore = await getProductStock(product.id);
    const orderBefore = await getOrderRow(orderId);

    await patchPayment(admin, orderId, { status: "PAID", payment_method: "CASH_ON_DELIVERY" });
    await patchPayment(admin, orderId, { status: "REFUNDED", refund_reason: "test" });

    const stockAfter = await getProductStock(product.id);
    const orderAfter = await getOrderRow(orderId);

    assert.equal(stockAfter, stockBefore, "stock unaffected by payment changes");
    assert.equal(orderAfter.status, orderBefore.status, "order status unaffected by payment changes");
  });

  test("Bank Transfer requires a transaction_reference when marking Paid", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { orderId } = await freshOrder(customer);

    let res = await patchPayment(admin, orderId, { status: "PAID", payment_method: "BANK_TRANSFER" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /transaction_reference is required/);

    const ref = unique("TRX");
    res = await patchPayment(admin, orderId, {
      status: "PAID",
      payment_method: "BANK_TRANSFER",
      transaction_reference: ref,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.payment.transaction_reference, ref);
  });
});
