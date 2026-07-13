import { describe, test, expect } from "vitest";
import {
  PAYMENT_STATUS_LABELS,
  paymentStatusLabel,
  paymentMethodLabel,
  getPaymentStatusBadgeStyle,
  getPaymentStatusActions,
  ALL_PAYMENT_STATUSES,
  ALL_PAYMENT_METHODS,
} from "./paymentStatus";

describe("paymentStatusLabel / paymentMethodLabel", () => {
  test("returns the correct customer-facing label for every payment status", () => {
    expect(paymentStatusLabel("PENDING")).toBe("Pending Payment");
    expect(paymentStatusLabel("PAID")).toBe("Paid");
    expect(paymentStatusLabel("FAILED")).toBe("Payment Failed");
    expect(paymentStatusLabel("REFUNDED")).toBe("Refunded");
  });

  test("returns the correct label for every payment method", () => {
    expect(paymentMethodLabel("CASH_ON_DELIVERY")).toBe("Cash on Delivery");
    expect(paymentMethodLabel("BANK_TRANSFER")).toBe("Bank Transfer");
    expect(paymentMethodLabel("MANUAL")).toBe("Manual Payment");
  });

  test("falls back to the raw value for an unknown status/method", () => {
    expect(paymentStatusLabel("WEIRD")).toBe("WEIRD");
    expect(paymentMethodLabel("CRYPTO")).toBe("CRYPTO");
  });

  test("every ALL_PAYMENT_STATUSES entry has a label", () => {
    for (const status of ALL_PAYMENT_STATUSES) {
      expect(typeof PAYMENT_STATUS_LABELS[status]).toBe("string");
    }
  });

  test("no CARD method exists among ALL_PAYMENT_METHODS", () => {
    expect(ALL_PAYMENT_METHODS).not.toContain("CARD");
  });
});

describe("getPaymentStatusBadgeStyle", () => {
  test("returns a distinct style for every payment status", () => {
    const seen = new Set();
    for (const status of ALL_PAYMENT_STATUSES) {
      seen.add(getPaymentStatusBadgeStyle(status).background);
    }
    expect(seen.size).toBe(ALL_PAYMENT_STATUSES.length);
  });
});

describe("getPaymentStatusActions", () => {
  test("PENDING offers Mark Paid and Mark Failed", () => {
    expect(getPaymentStatusActions("PENDING").map((a) => a.to)).toEqual(["PAID", "FAILED"]);
  });

  test("FAILED offers Retry (Pending) and Mark Paid", () => {
    expect(getPaymentStatusActions("FAILED").map((a) => a.to)).toEqual(["PENDING", "PAID"]);
  });

  test("PAID offers only Mark Refunded", () => {
    expect(getPaymentStatusActions("PAID").map((a) => a.to)).toEqual(["REFUNDED"]);
  });

  test("REFUNDED offers no actions (terminal)", () => {
    expect(getPaymentStatusActions("REFUNDED")).toEqual([]);
  });
});
