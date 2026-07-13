// Task P1: pure unit tests for the one genuinely database-free inventory
// helper. resolveInventoryVariant needs a real queryable connection (it
// resolves colors/sizes/variant rows), so it's covered by the checkout
// integration tests instead — duplicating its SQL-driving logic here with
// a mock would test the mock, not the real behavior.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { computeAvailabilityStatus } = require("../../src/utils/inventory");

describe("computeAvailabilityStatus — General/Variant shared thresholds", () => {
  test("0 stock is OUT_OF_STOCK", () => {
    assert.equal(computeAvailabilityStatus(0), "OUT_OF_STOCK");
  });

  test("negative stock is treated as OUT_OF_STOCK, never a negative status", () => {
    assert.equal(computeAvailabilityStatus(-5), "OUT_OF_STOCK");
  });

  test("1 and 2 are ALMOST_GONE", () => {
    assert.equal(computeAvailabilityStatus(1), "ALMOST_GONE");
    assert.equal(computeAvailabilityStatus(2), "ALMOST_GONE");
  });

  test("3 through 5 are LOW_STOCK", () => {
    assert.equal(computeAvailabilityStatus(3), "LOW_STOCK");
    assert.equal(computeAvailabilityStatus(4), "LOW_STOCK");
    assert.equal(computeAvailabilityStatus(5), "LOW_STOCK");
  });

  test("6 and above are AVAILABLE", () => {
    assert.equal(computeAvailabilityStatus(6), "AVAILABLE");
    assert.equal(computeAvailabilityStatus(1000), "AVAILABLE");
  });

  test("null/undefined stock is treated as 0 -> OUT_OF_STOCK", () => {
    assert.equal(computeAvailabilityStatus(null), "OUT_OF_STOCK");
    assert.equal(computeAvailabilityStatus(undefined), "OUT_OF_STOCK");
  });

  test("a numeric string is coerced correctly (Postgres COUNT/quantity can arrive as text)", () => {
    assert.equal(computeAvailabilityStatus("4"), "LOW_STOCK");
    assert.equal(computeAvailabilityStatus("0"), "OUT_OF_STOCK");
  });
});
