// Task N1: shared payment-status helpers for AdminOrders, MyOrders, and
// Dashboard, mirroring frontend/src/utils/orderStatus.js's shape so the two
// systems stay easy to reason about side by side. No real payment gateway
// is integrated — payment_method is a manually-recorded label only.

export const PAYMENT_STATUS_LABELS = {
  PENDING: "Pending Payment",
  PAID: "Paid",
  FAILED: "Payment Failed",
  REFUNDED: "Refunded",
};

export function paymentStatusLabel(status) {
  return PAYMENT_STATUS_LABELS[status] || status || "—";
}

export const ALL_PAYMENT_STATUSES = Object.keys(PAYMENT_STATUS_LABELS);

export const PAYMENT_METHOD_LABELS = {
  CASH_ON_DELIVERY: "Cash on Delivery",
  BANK_TRANSFER: "Bank Transfer",
  MANUAL: "Manual Payment",
};

export function paymentMethodLabel(method) {
  return PAYMENT_METHOD_LABELS[method] || method || "—";
}

export const ALL_PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS);

export const PAYMENT_STATUS_BADGE_STYLES = {
  PENDING: { background: "#fff8ec", color: "#b07d2a", border: "#f0d9a0", dot: "#e6a820" },
  PAID: { background: "#edfbf3", color: "#1a7a45", border: "#a3dfc0", dot: "#1a7a45" },
  FAILED: { background: "#fdf2f2", color: "#b52a2a", border: "#f0b3b3", dot: "#c0392b" },
  REFUNDED: { background: "#f0f0f0", color: "#555", border: "#d8d8d8", dot: "#888" },
};

export function getPaymentStatusBadgeStyle(status) {
  return PAYMENT_STATUS_BADGE_STYLES[status] || PAYMENT_STATUS_BADGE_STYLES.PENDING;
}

// Valid next actions per current payment status, in display order — matches
// backend/src/utils/paymentStatus.js's PAYMENT_TRANSITIONS exactly. The
// backend re-validates independently; this only decides which buttons show.
export const PAYMENT_STATUS_ACTIONS = {
  PENDING: [
    { to: "PAID", label: "Mark Paid", kind: "primary" },
    { to: "FAILED", label: "Mark Failed", kind: "danger" },
  ],
  FAILED: [
    { to: "PENDING", label: "Retry / Mark Pending", kind: "default" },
    { to: "PAID", label: "Mark Paid", kind: "primary" },
  ],
  PAID: [{ to: "REFUNDED", label: "Mark Refunded", kind: "danger" }],
  REFUNDED: [],
};

export function getPaymentStatusActions(status) {
  return PAYMENT_STATUS_ACTIONS[status] || [];
}
