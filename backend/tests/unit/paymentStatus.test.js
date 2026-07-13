// Task P1: pure unit tests for the payment lifecycle helper.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  PAYMENT_STATUS_LABELS,
  VALID_PAYMENT_STATUSES,
  PAYMENT_METHOD_LABELS,
  VALID_PAYMENT_METHODS,
  validatePaymentTransition,
} = require("../../src/utils/paymentStatus");

describe("paymentStatus.validatePaymentTransition — allowed transitions", () => {
  const allowed = [
    ["PENDING", "PAID"],
    ["PENDING", "FAILED"],
    ["FAILED", "PENDING"],
    ["FAILED", "PAID"],
    ["PAID", "REFUNDED"],
  ];

  for (const [from, to] of allowed) {
    test(`${from} -> ${to} is allowed`, () => {
      const result = validatePaymentTransition(from, to);
      assert.equal(result.ok, true);
      assert.equal(result.idempotent, false);
    });
  }
});

describe("paymentStatus.validatePaymentTransition — rejected transitions", () => {
  test("PENDING -> REFUNDED is rejected with the exact spec message", () => {
    const result = validatePaymentTransition("PENDING", "REFUNDED");
    assert.equal(result.ok, false);
    assert.equal(result.error, "This payment must be marked as Paid before it can be refunded.");
  });

  test("FAILED -> REFUNDED is rejected with the exact spec message", () => {
    const result = validatePaymentTransition("FAILED", "REFUNDED");
    assert.equal(result.ok, false);
    assert.equal(result.error, "This payment must be marked as Paid before it can be refunded.");
  });

  test("REFUNDED -> PAID is rejected with the specific 'back to Paid' message", () => {
    const result = validatePaymentTransition("REFUNDED", "PAID");
    assert.equal(result.ok, false);
    assert.equal(result.error, "This payment cannot move from Refunded back to Paid.");
  });

  test("REFUNDED -> PENDING is rejected with the generic 'already refunded' message", () => {
    const result = validatePaymentTransition("REFUNDED", "PENDING");
    assert.equal(result.ok, false);
    assert.equal(result.error, "This payment has already been refunded.");
  });
});

describe("paymentStatus.validatePaymentTransition — idempotency", () => {
  for (const status of VALID_PAYMENT_STATUSES) {
    test(`re-selecting the same status (${status}) is idempotent, not an error`, () => {
      const result = validatePaymentTransition(status, status);
      assert.equal(result.ok, true);
      assert.equal(result.idempotent, true);
    });
  }

  test("REFUNDED -> REFUNDED is idempotent even though REFUNDED is terminal", () => {
    const result = validatePaymentTransition("REFUNDED", "REFUNDED");
    assert.equal(result.ok, true);
    assert.equal(result.idempotent, true);
  });
});

describe("paymentStatus labels", () => {
  test("every valid payment status has a customer-facing label", () => {
    for (const status of VALID_PAYMENT_STATUSES) {
      assert.equal(typeof PAYMENT_STATUS_LABELS[status], "string");
    }
    assert.equal(PAYMENT_STATUS_LABELS.PENDING, "Pending Payment");
    assert.equal(PAYMENT_STATUS_LABELS.PAID, "Paid");
    assert.equal(PAYMENT_STATUS_LABELS.FAILED, "Payment Failed");
    assert.equal(PAYMENT_STATUS_LABELS.REFUNDED, "Refunded");
  });

  test("every valid payment method has a customer-facing label", () => {
    for (const method of VALID_PAYMENT_METHODS) {
      assert.equal(typeof PAYMENT_METHOD_LABELS[method], "string");
    }
    assert.equal(PAYMENT_METHOD_LABELS.CASH_ON_DELIVERY, "Cash on Delivery");
    assert.equal(PAYMENT_METHOD_LABELS.BANK_TRANSFER, "Bank Transfer");
    assert.equal(PAYMENT_METHOD_LABELS.MANUAL, "Manual Payment");
  });

  test("no CARD payment method exists (no real gateway integrated)", () => {
    assert.equal(VALID_PAYMENT_METHODS.includes("CARD"), false);
  });
});
