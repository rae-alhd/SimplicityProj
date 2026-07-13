// Task P1: pure unit tests for shipping & fulfillment validation. No real
// carrier API is integrated — everything here is owner-entered text/URLs.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  SHIPPING_METHOD_LABELS,
  VALID_SHIPPING_METHODS,
  isSafeTrackingUrl,
  isValidDateOnlyString,
  validateFulfillmentInput,
  validateReadyToShippedRequirements,
} = require("../../src/utils/fulfillment");

describe("isSafeTrackingUrl", () => {
  test("accepts a well-formed http:// URL", () => {
    assert.equal(isSafeTrackingUrl("http://tracking.example.com/ABC123"), true);
  });

  test("accepts a well-formed https:// URL", () => {
    assert.equal(isSafeTrackingUrl("https://tracking.example.com/ABC123"), true);
  });

  test("rejects a javascript: URL", () => {
    assert.equal(isSafeTrackingUrl("javascript:alert(1)"), false);
  });

  test("rejects a data: URL", () => {
    assert.equal(isSafeTrackingUrl("data:text/html,<script>alert(1)</script>"), false);
  });

  test("rejects a malformed URL", () => {
    assert.equal(isSafeTrackingUrl("not a url at all"), false);
  });

  test("rejects an empty/missing value", () => {
    assert.equal(isSafeTrackingUrl(""), false);
    assert.equal(isSafeTrackingUrl(null), false);
    assert.equal(isSafeTrackingUrl(undefined), false);
  });

  test("rejects a non-string value", () => {
    assert.equal(isSafeTrackingUrl(12345), false);
  });
});

describe("isValidDateOnlyString", () => {
  test("accepts a valid YYYY-MM-DD date", () => {
    assert.equal(isValidDateOnlyString("2026-08-01"), true);
  });

  // Known, pre-existing lenient behavior (not something this test suite
  // changes): `new Date("2026-02-30T...")` silently rolls over to March 2
  // rather than producing an Invalid Date, so isValidDateOnlyString's
  // NaN-check can't catch a calendar-invalid-but-numeric day like this.
  // The format regex is what actually does the heavy lifting here.
  test("a calendar-overflow date (Feb 30) passes today via JS Date rollover — documented, not silently fixed", () => {
    assert.equal(isValidDateOnlyString("2026-02-30"), true);
  });

  test("rejects an out-of-range month", () => {
    assert.equal(isValidDateOnlyString("2026-13-01"), false);
  });

  test("rejects a non-date-only format", () => {
    assert.equal(isValidDateOnlyString("2026-08-01T00:00:00Z"), false);
    assert.equal(isValidDateOnlyString("08/01/2026"), false);
    assert.equal(isValidDateOnlyString("not a date"), false);
  });

  test("rejects null/undefined/number", () => {
    assert.equal(isValidDateOnlyString(null), false);
    assert.equal(isValidDateOnlyString(undefined), false);
    assert.equal(isValidDateOnlyString(20260801), false);
  });
});

describe("SHIPPING_METHOD_LABELS / VALID_SHIPPING_METHODS", () => {
  test("recognizes exactly COURIER, PICKUP, MANUAL", () => {
    assert.deepEqual([...VALID_SHIPPING_METHODS].sort(), ["COURIER", "MANUAL", "PICKUP"]);
  });

  test("no carrier-specific enum values exist", () => {
    assert.equal(VALID_SHIPPING_METHODS.includes("DHL"), false);
    assert.equal(VALID_SHIPPING_METHODS.includes("UPS"), false);
  });

  test("labels match the exact expected wording", () => {
    assert.equal(SHIPPING_METHOD_LABELS.COURIER, "Courier Delivery");
    assert.equal(SHIPPING_METHOD_LABELS.PICKUP, "Store Pickup");
    assert.equal(SHIPPING_METHOD_LABELS.MANUAL, "Manual Delivery");
  });
});

describe("validateFulfillmentInput", () => {
  test("accepts an empty body (nothing to validate)", () => {
    const result = validateFulfillmentInput({});
    assert.equal(result.ok, true);
    assert.deepEqual(result.fields, {});
  });

  test("rejects an unrecognized shipping_method", () => {
    const result = validateFulfillmentInput({ shipping_method: "DRONE" });
    assert.equal(result.ok, false);
    assert.match(result.error, /shipping_method must be one of/);
  });

  test("rejects a javascript: tracking_url", () => {
    const result = validateFulfillmentInput({ tracking_url: "javascript:alert(1)" });
    assert.equal(result.ok, false);
    assert.match(result.error, /http:\/\/ or https:\/\//);
  });

  test("rejects a data: tracking_url", () => {
    const result = validateFulfillmentInput({ tracking_url: "data:text/html,x" });
    assert.equal(result.ok, false);
  });

  test("rejects a malformed tracking_url", () => {
    const result = validateFulfillmentInput({ tracking_url: "not a url" });
    assert.equal(result.ok, false);
  });

  test("accepts a safe https tracking_url", () => {
    const result = validateFulfillmentInput({ tracking_url: "https://track.example.com/1" });
    assert.equal(result.ok, true);
    assert.equal(result.fields.tracking_url, "https://track.example.com/1");
  });

  test("empty-string tracking_url clears it to null rather than rejecting", () => {
    const result = validateFulfillmentInput({ tracking_url: "" });
    assert.equal(result.ok, true);
    assert.equal(result.fields.tracking_url, null);
  });

  test("rejects an invalid estimated_delivery_date", () => {
    const result = validateFulfillmentInput({ estimated_delivery_date: "not-a-date" });
    assert.equal(result.ok, false);
    assert.match(result.error, /estimated_delivery_date/);
  });

  test("accepts a valid estimated_delivery_date", () => {
    const result = validateFulfillmentInput({ estimated_delivery_date: "2026-08-01" });
    assert.equal(result.ok, true);
    assert.equal(result.fields.estimated_delivery_date, "2026-08-01");
  });

  test("null estimated_delivery_date clears it without rejecting", () => {
    const result = validateFulfillmentInput({ estimated_delivery_date: null });
    assert.equal(result.ok, true);
    assert.equal(result.fields.estimated_delivery_date, null);
  });

  test("rejects a non-boolean tracking_unavailable (string 'true')", () => {
    const result = validateFulfillmentInput({ tracking_unavailable: "true" });
    assert.equal(result.ok, false);
    assert.match(result.error, /must be a boolean/);
  });

  test("rejects a non-boolean tracking_unavailable (number 1)", () => {
    const result = validateFulfillmentInput({ tracking_unavailable: 1 });
    assert.equal(result.ok, false);
  });

  test("accepts a real boolean tracking_unavailable", () => {
    const result = validateFulfillmentInput({ tracking_unavailable: true });
    assert.equal(result.ok, true);
    assert.equal(result.fields.tracking_unavailable, true);
  });

  test("trims and length-caps carrier_name", () => {
    const result = validateFulfillmentInput({ carrier_name: "  Aras Kargo  " });
    assert.equal(result.ok, true);
    assert.equal(result.fields.carrier_name, "Aras Kargo");
  });

  test("rejects an over-length carrier_name", () => {
    const result = validateFulfillmentInput({ carrier_name: "x".repeat(121) });
    assert.equal(result.ok, false);
  });

  test("rejects an over-length tracking_number", () => {
    const result = validateFulfillmentInput({ tracking_number: "x".repeat(101) });
    assert.equal(result.ok, false);
  });

  test("rejects an over-length private_note", () => {
    const result = validateFulfillmentInput({ private_note: "x".repeat(2001) });
    assert.equal(result.ok, false);
  });
});

describe("validateReadyToShippedRequirements", () => {
  test("rejects when shipping_method is missing entirely", () => {
    const result = validateReadyToShippedRequirements({}, false);
    assert.equal(result.ok, false);
    assert.match(result.error, /shipping_method is required/);
  });

  test("Courier without carrier_name is rejected", () => {
    const result = validateReadyToShippedRequirements(
      { shipping_method: "COURIER", tracking_number: "TRK1" },
      false
    );
    assert.equal(result.ok, false);
    assert.match(result.error, /carrier_name is required/);
  });

  test("Courier without tracking_number and without unavailable confirmation is rejected", () => {
    const result = validateReadyToShippedRequirements(
      { shipping_method: "COURIER", carrier_name: "Aras Kargo" },
      false
    );
    assert.equal(result.ok, false);
    assert.match(result.error, /tracking_number is required/);
  });

  test("Courier with a tracking_number succeeds", () => {
    const result = validateReadyToShippedRequirements(
      { shipping_method: "COURIER", carrier_name: "Aras Kargo", tracking_number: "TRK1" },
      false
    );
    assert.equal(result.ok, true);
  });

  test("Courier with tracking_unavailable=true (no number) succeeds", () => {
    const result = validateReadyToShippedRequirements(
      { shipping_method: "COURIER", carrier_name: "Aras Kargo" },
      true
    );
    assert.equal(result.ok, true);
  });

  test("Pickup without carrier or tracking succeeds", () => {
    const result = validateReadyToShippedRequirements({ shipping_method: "PICKUP" }, false);
    assert.equal(result.ok, true);
  });

  test("Manual without carrier or tracking succeeds", () => {
    const result = validateReadyToShippedRequirements({ shipping_method: "MANUAL" }, false);
    assert.equal(result.ok, true);
  });
});
