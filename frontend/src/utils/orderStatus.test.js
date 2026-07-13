import { describe, test, expect } from "vitest";
import {
  STATUS_LABELS,
  statusLabel,
  getStatusBadgeStyle,
  getStatusActions,
  ALL_STATUSES,
  buildCustomerStages,
} from "./orderStatus";

describe("statusLabel", () => {
  test("returns the customer-facing label for a known status", () => {
    expect(statusLabel("in_production")).toBe("In Production");
    expect(statusLabel("design_review")).toBe("Design Review");
  });

  test("falls back to the raw value for an unknown status", () => {
    expect(statusLabel("weird_status")).toBe("weird_status");
  });

  test("falls back to an em dash for a missing status", () => {
    expect(statusLabel(undefined)).toBe("—");
    expect(statusLabel(null)).toBe("—");
  });

  test("every status in ALL_STATUSES has a label", () => {
    for (const status of ALL_STATUSES) {
      expect(typeof STATUS_LABELS[status]).toBe("string");
    }
  });
});

describe("getStatusBadgeStyle", () => {
  test("returns a distinct badge config for every known status", () => {
    const seen = new Set();
    for (const status of ALL_STATUSES) {
      const cfg = getStatusBadgeStyle(status);
      expect(cfg).toHaveProperty("background");
      expect(cfg).toHaveProperty("color");
      expect(cfg).toHaveProperty("border");
      expect(cfg).toHaveProperty("dot");
      seen.add(cfg.background);
    }
    expect(seen.size).toBe(ALL_STATUSES.length);
  });

  test("falls back to the 'new' style for an unknown status", () => {
    expect(getStatusBadgeStyle("bogus")).toEqual(getStatusBadgeStyle("new"));
  });
});

describe("getStatusActions", () => {
  test("Ready offers Mark Shipped and Cancel Order", () => {
    const actions = getStatusActions("ready");
    expect(actions.map((a) => a.to)).toEqual(["shipped", "cancelled"]);
  });

  test("Shipped only offers Mark Delivered (no cancel)", () => {
    const actions = getStatusActions("shipped");
    expect(actions.map((a) => a.to)).toEqual(["delivered"]);
  });

  test("Delivered and Cancelled offer no actions (terminal)", () => {
    expect(getStatusActions("delivered")).toEqual([]);
    expect(getStatusActions("cancelled")).toEqual([]);
  });

  test("an unknown status offers no actions rather than throwing", () => {
    expect(getStatusActions("bogus")).toEqual([]);
  });
});

describe("buildCustomerStages", () => {
  test("a ready-to-wear order that skipped Design Review never shows it", () => {
    const order = {
      status: "in_production",
      status_timeline: [
        { status: "new", timestamp: "2026-01-01T00:00:00Z" },
        { status: "in_production", timestamp: "2026-01-02T00:00:00Z" },
      ],
    };
    const stages = buildCustomerStages(order);
    expect(stages.some((s) => s.status === "design_review")).toBe(false);
  });

  test("an order that actually visited Design Review shows it as completed", () => {
    const order = {
      status: "ready",
      status_timeline: [
        { status: "new", timestamp: "2026-01-01T00:00:00Z" },
        { status: "design_review", timestamp: "2026-01-02T00:00:00Z" },
        { status: "in_production", timestamp: "2026-01-03T00:00:00Z" },
        { status: "ready", timestamp: "2026-01-04T00:00:00Z" },
      ],
    };
    const stages = buildCustomerStages(order);
    const dr = stages.find((s) => s.status === "design_review");
    expect(dr).toBeDefined();
    expect(dr.state).toBe("completed");
  });

  test("a brand-new order still shows Design Review as an upcoming (not yet foreclosed) possibility", () => {
    const order = {
      status: "new",
      status_timeline: [{ status: "new", timestamp: "2026-01-01T00:00:00Z" }],
    };
    const stages = buildCustomerStages(order);
    const dr = stages.find((s) => s.status === "design_review");
    expect(dr).toBeDefined();
    expect(dr.state).toBe("upcoming");
  });

  test("the current stage is marked 'current', not 'completed'", () => {
    const order = {
      status: "in_production",
      status_timeline: [
        { status: "new", timestamp: "2026-01-01T00:00:00Z" },
        { status: "in_production", timestamp: "2026-01-02T00:00:00Z" },
      ],
    };
    const stages = buildCustomerStages(order);
    const current = stages.find((s) => s.status === "in_production");
    expect(current.state).toBe("current");
    const upcoming = stages.find((s) => s.status === "ready");
    expect(upcoming.state).toBe("upcoming");
  });
});
