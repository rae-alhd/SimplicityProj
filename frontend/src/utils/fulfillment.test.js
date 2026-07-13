import { describe, test, expect } from "vitest";
import {
  SHIPPING_METHOD_LABELS,
  shippingMethodLabel,
  ALL_SHIPPING_METHODS,
  isSafeTrackingUrl,
  formatDateOnly,
} from "./fulfillment";

describe("shippingMethodLabel", () => {
  test("returns the correct label for every shipping method", () => {
    expect(shippingMethodLabel("COURIER")).toBe("Courier Delivery");
    expect(shippingMethodLabel("PICKUP")).toBe("Store Pickup");
    expect(shippingMethodLabel("MANUAL")).toBe("Manual Delivery");
  });

  test("falls back to an em dash for a missing method", () => {
    expect(shippingMethodLabel(null)).toBe("—");
    expect(shippingMethodLabel(undefined)).toBe("—");
  });

  test("no carrier-specific labels (DHL/UPS) exist", () => {
    expect(ALL_SHIPPING_METHODS).not.toContain("DHL");
    expect(ALL_SHIPPING_METHODS).not.toContain("UPS");
  });

  test("every method has a label", () => {
    for (const method of ALL_SHIPPING_METHODS) {
      expect(typeof SHIPPING_METHOD_LABELS[method]).toBe("string");
    }
  });
});

describe("isSafeTrackingUrl", () => {
  test("accepts http:// and https:// URLs", () => {
    expect(isSafeTrackingUrl("http://track.example.com/1")).toBe(true);
    expect(isSafeTrackingUrl("https://track.example.com/1")).toBe(true);
  });

  test("rejects javascript: and data: URLs", () => {
    expect(isSafeTrackingUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeTrackingUrl("data:text/html,x")).toBe(false);
  });

  test("rejects a malformed or missing URL", () => {
    expect(isSafeTrackingUrl("not a url")).toBe(false);
    expect(isSafeTrackingUrl("")).toBe(false);
    expect(isSafeTrackingUrl(null)).toBe(false);
  });
});

describe("formatDateOnly", () => {
  test("formats a YYYY-MM-DD date without a timezone-driven day shift", () => {
    const result = formatDateOnly("2026-08-01");
    expect(result).not.toBe("—");
    expect(result).toMatch(/2026/);
  });

  test("returns an em dash for a missing date", () => {
    expect(formatDateOnly(null)).toBe("—");
    expect(formatDateOnly(undefined)).toBe("—");
  });
});
