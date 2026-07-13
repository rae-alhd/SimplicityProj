// Task P1: pure unit tests for the order production workflow — no database,
// no HTTP, just the real exported helper. Node's built-in test runner:
// https://nodejs.org/api/test.html
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  STATUS_LABELS,
  VALID_STATUSES,
  validateTransition,
} = require("../../src/utils/orderStatus");

describe("orderStatus.validateTransition — allowed transitions", () => {
  const allowed = [
    ["new", "design_review"],
    ["new", "in_production"],
    ["design_review", "in_production"],
    ["in_production", "ready"],
    ["ready", "shipped"],
    ["shipped", "delivered"],
    ["new", "cancelled"],
    ["design_review", "cancelled"],
    ["in_production", "cancelled"],
    ["ready", "cancelled"],
  ];

  for (const [from, to] of allowed) {
    test(`${from} -> ${to} is allowed`, () => {
      const result = validateTransition(from, to);
      assert.equal(result.ok, true);
      assert.equal(result.idempotent, false);
    });
  }
});

describe("orderStatus.validateTransition — rejected transitions", () => {
  test("new -> shipped is rejected with the exact spec message", () => {
    const result = validateTransition("new", "shipped");
    assert.equal(result.ok, false);
    assert.equal(result.error, "This order cannot move from New directly to Shipped.");
  });

  test("ready -> delivered is rejected", () => {
    const result = validateTransition("ready", "delivered");
    assert.equal(result.ok, false);
    assert.equal(result.error, "This order cannot move from Ready directly to Delivered.");
  });

  test("shipped -> cancelled is rejected with the exact spec message", () => {
    const result = validateTransition("shipped", "cancelled");
    assert.equal(result.ok, false);
    assert.equal(result.error, "Shipped orders can no longer be cancelled.");
  });

  test("delivered -> cancelled is rejected (final status)", () => {
    const result = validateTransition("delivered", "cancelled");
    assert.equal(result.ok, false);
    assert.equal(result.error, "This order has already reached a final status.");
  });

  test("cancelled -> new is rejected (final status)", () => {
    const result = validateTransition("cancelled", "new");
    assert.equal(result.ok, false);
    assert.equal(result.error, "This order has already reached a final status.");
  });
});

describe("orderStatus.validateTransition — idempotency", () => {
  for (const status of VALID_STATUSES) {
    test(`re-selecting the same status (${status}) is idempotent, not an error`, () => {
      const result = validateTransition(status, status);
      assert.equal(result.ok, true);
      assert.equal(result.idempotent, true);
    });
  }
});

describe("orderStatus.STATUS_LABELS", () => {
  test("every valid status has a human-readable label", () => {
    for (const status of VALID_STATUSES) {
      assert.equal(typeof STATUS_LABELS[status], "string");
      assert.ok(STATUS_LABELS[status].length > 0);
    }
  });

  test("labels match the exact expected wording", () => {
    assert.equal(STATUS_LABELS.new, "New");
    assert.equal(STATUS_LABELS.design_review, "Design Review");
    assert.equal(STATUS_LABELS.in_production, "In Production");
    assert.equal(STATUS_LABELS.ready, "Ready");
    assert.equal(STATUS_LABELS.shipped, "Shipped");
    assert.equal(STATUS_LABELS.delivered, "Delivered");
    assert.equal(STATUS_LABELS.cancelled, "Cancelled");
  });
});
