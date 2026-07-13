// Task M1: shared order-status helpers for AdminOrders and MyOrders, so the
// label map / badge colors / valid next actions / timeline logic live in
// exactly one place. Mirrors backend/src/utils/orderStatus.js — the backend
// remains the source of truth for which transitions are actually allowed;
// this file only decides how to *display* them.

export const STATUS_LABELS = {
  new: "New",
  design_review: "Design Review",
  in_production: "In Production",
  ready: "Ready",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || "—";
}

// Subtle, distinct badge colors consistent with the existing Simplicity
// palette already used for pending/confirmed/delivered/cancelled.
export const STATUS_BADGE_STYLES = {
  new: { background: "#fff8ec", color: "#b07d2a", border: "#f0d9a0", dot: "#e6a820" },
  design_review: { background: "#f4f1fb", color: "#6a4fc2", border: "#dcd2f2", dot: "#6a4fc2" },
  in_production: { background: "#edf6ff", color: "#1a6fb5", border: "#b3d4f5", dot: "#1a6fb5" },
  ready: { background: "#fef9e7", color: "#9c7a12", border: "#f0e2a0", dot: "#c79e1a" },
  shipped: { background: "#eef1ff", color: "#3d4fb5", border: "#c7cef2", dot: "#3d4fb5" },
  delivered: { background: "#edfbf3", color: "#1a7a45", border: "#a3dfc0", dot: "#1a7a45" },
  cancelled: { background: "#fdf2f2", color: "#b52a2a", border: "#f0b3b3", dot: "#c0392b" },
};

export function getStatusBadgeStyle(status) {
  return STATUS_BADGE_STYLES[status] || STATUS_BADGE_STYLES.new;
}

// Valid next actions per current status, in display order. Matches the
// backend transition graph in backend/src/utils/orderStatus.js exactly —
// the backend still re-validates independently, this only decides which
// buttons to show.
export const STATUS_ACTIONS = {
  new: [
    { to: "design_review", label: "Send to Design Review", kind: "default" },
    { to: "in_production", label: "Start Production", kind: "primary" },
    { to: "cancelled", label: "Cancel Order", kind: "danger" },
  ],
  design_review: [
    { to: "in_production", label: "Approve and Start Production", kind: "primary" },
    { to: "cancelled", label: "Cancel Order", kind: "danger" },
  ],
  in_production: [
    { to: "ready", label: "Mark Ready", kind: "primary" },
    { to: "cancelled", label: "Cancel Order", kind: "danger" },
  ],
  ready: [
    { to: "shipped", label: "Mark Shipped", kind: "primary" },
    { to: "cancelled", label: "Cancel Order", kind: "danger" },
  ],
  shipped: [{ to: "delivered", label: "Mark Delivered", kind: "primary" }],
  delivered: [],
  cancelled: [],
};

export function getStatusActions(status) {
  return STATUS_ACTIONS[status] || [];
}

export const ALL_STATUSES = Object.keys(STATUS_LABELS);

// Canonical customer-facing progress sequence for non-cancelled orders.
export const CUSTOMER_STAGE_SEQUENCE = [
  "new",
  "design_review",
  "in_production",
  "ready",
  "shipped",
  "delivered",
];

/* ─────────────────────────────────────────────
   Builds the ordered stepper stages for a customer's order, from the
   backend's customer-safe status_timeline (oldest -> newest) plus the
   order's current status. Design Review is only included if the order
   actually passed through it, or if it's still early enough (status still
   'new') that it might happen — a ready-to-wear order that went straight
   to In Production never shows Design Review as a false "completed" step.
   Intended for non-cancelled orders only; callers should branch on
   order.status === "cancelled" separately.
───────────────────────────────────────────── */
export function buildCustomerStages(order) {
  const timeline = Array.isArray(order.status_timeline) ? order.status_timeline : [];
  const visitedStatuses = new Set(timeline.map((entry) => entry.status));
  const currentStatus = order.status;

  const sequence = CUSTOMER_STAGE_SEQUENCE.filter((stage) => {
    if (stage !== "design_review") return true;
    return visitedStatuses.has("design_review") || currentStatus === "new";
  });

  return sequence.map((stage) => {
    const visitedEntry = timeline.find((entry) => entry.status === stage);
    const state = !visitedEntry
      ? "upcoming"
      : stage === currentStatus
      ? "current"
      : "completed";

    return {
      status: stage,
      label: STATUS_LABELS[stage],
      timestamp: visitedEntry ? visitedEntry.timestamp : null,
      state,
    };
  });
}
