// Task N1: single source of truth for the payment lifecycle, mirroring
// backend/src/utils/orderStatus.js's shape/conventions so the two systems
// stay easy to reason about side by side. No real payment gateway is
// integrated in this project — payment_method is a manually-recorded label
// only (Cash on Delivery / Bank Transfer / Manual), never a card number or
// any other sensitive credential.

const PAYMENT_STATUS_LABELS = {
  PENDING: "Pending Payment",
  PAID: "Paid",
  FAILED: "Payment Failed",
  REFUNDED: "Refunded",
};

const VALID_PAYMENT_STATUSES = Object.keys(PAYMENT_STATUS_LABELS);

const PAYMENT_METHOD_LABELS = {
  CASH_ON_DELIVERY: "Cash on Delivery",
  BANK_TRANSFER: "Bank Transfer",
  MANUAL: "Manual Payment",
};

const VALID_PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS);

// Allowed forward transitions. REFUNDED has none — it is always terminal.
const PAYMENT_TRANSITIONS = {
  PENDING: ["PAID", "FAILED"],
  FAILED: ["PENDING", "PAID"],
  PAID: ["REFUNDED"],
  REFUNDED: [],
};

/* ─────────────────────────────────────────────
   Validates a proposed payment status transition. Returns:
     { ok: true, idempotent: true }   — same status re-selected, no-op
     { ok: true, idempotent: false }  — a real, allowed transition
     { ok: false, error }             — rejected, with a readable reason
───────────────────────────────────────────── */
function validatePaymentTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) {
    return { ok: true, idempotent: true };
  }

  if (currentStatus === "REFUNDED") {
    if (nextStatus === "PAID") {
      return { ok: false, error: "This payment cannot move from Refunded back to Paid." };
    }
    return { ok: false, error: "This payment has already been refunded." };
  }

  if (nextStatus === "REFUNDED" && currentStatus !== "PAID") {
    return { ok: false, error: "This payment must be marked as Paid before it can be refunded." };
  }

  if (!PAYMENT_TRANSITIONS[currentStatus].includes(nextStatus)) {
    return {
      ok: false,
      error: `This payment cannot move from ${PAYMENT_STATUS_LABELS[currentStatus]} to ${PAYMENT_STATUS_LABELS[nextStatus]}.`,
    };
  }

  return { ok: true, idempotent: false };
}

module.exports = {
  PAYMENT_STATUS_LABELS,
  VALID_PAYMENT_STATUSES,
  PAYMENT_METHOD_LABELS,
  VALID_PAYMENT_METHODS,
  PAYMENT_TRANSITIONS,
  validatePaymentTransition,
};
