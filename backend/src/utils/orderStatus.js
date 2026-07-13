// Task M1: single source of truth for the order production workflow, shared
// by the status-update route and the admin/customer order list routes so
// the transition graph and labels never drift apart between them.

const STATUS_LABELS = {
  new: "New",
  design_review: "Design Review",
  in_production: "In Production",
  ready: "Ready",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const VALID_STATUSES = Object.keys(STATUS_LABELS);

const TERMINAL_STATUSES = ["delivered", "cancelled"];

// Allowed forward transitions. 'cancelled' is intentionally omitted from
// shipped's list — cancellation is only safe before the order has left the
// building — and delivered/cancelled have no outgoing transitions at all.
const TRANSITIONS = {
  new: ["design_review", "in_production", "cancelled"],
  design_review: ["in_production", "cancelled"],
  in_production: ["ready", "cancelled"],
  ready: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

/* ─────────────────────────────────────────────
   Validates a proposed status transition. Returns:
     { ok: true, idempotent: true }   — same status re-selected, no-op
     { ok: true, idempotent: false }  — a real, allowed transition
     { ok: false, error }             — rejected, with a customer/admin-
                                         readable explanation
───────────────────────────────────────────── */
function validateTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) {
    return { ok: true, idempotent: true };
  }

  if (TERMINAL_STATUSES.includes(currentStatus)) {
    return { ok: false, error: "This order has already reached a final status." };
  }

  if (nextStatus === "cancelled") {
    if (!TRANSITIONS[currentStatus].includes("cancelled")) {
      // Only reachable from 'shipped' today (the one non-terminal status
      // that doesn't allow cancellation) — worded specifically per spec
      // rather than the generic "cannot move from X to Y" message below.
      return { ok: false, error: "Shipped orders can no longer be cancelled." };
    }
    return { ok: true, idempotent: false };
  }

  if (!TRANSITIONS[currentStatus].includes(nextStatus)) {
    return {
      ok: false,
      error: `This order cannot move from ${STATUS_LABELS[currentStatus]} directly to ${STATUS_LABELS[nextStatus]}.`,
    };
  }

  return { ok: true, idempotent: false };
}

module.exports = {
  STATUS_LABELS,
  VALID_STATUSES,
  TERMINAL_STATUSES,
  TRANSITIONS,
  validateTransition,
};
