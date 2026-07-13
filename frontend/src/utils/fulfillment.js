// Task O1: shared shipping & fulfillment helpers for AdminOrders and
// MyOrders, mirroring frontend/src/utils/orderStatus.js and
// frontend/src/utils/paymentStatus.js's conventions. No carrier API is
// integrated — every field is entered manually by the owner.

export const SHIPPING_METHOD_LABELS = {
  COURIER: "Courier Delivery",
  PICKUP: "Store Pickup",
  MANUAL: "Manual Delivery",
};

export function shippingMethodLabel(method) {
  return SHIPPING_METHOD_LABELS[method] || method || "—";
}

export const ALL_SHIPPING_METHODS = Object.keys(SHIPPING_METHOD_LABELS);

// Badge styles for the derived fulfillment states — distinct colors from
// the order-status and payment-status badges so all three families stay
// visually distinguishable on the same card.
export const FULFILLMENT_BADGE_STYLES = {
  ready_to_ship: { background: "#fef9e7", color: "#9c7a12", border: "#f0e2a0" },
  in_transit: { background: "#eef1ff", color: "#3d4fb5", border: "#c7cef2" },
  delivered: { background: "#edfbf3", color: "#1a7a45", border: "#a3dfc0" },
  tracking_missing: { background: "#fdf2f2", color: "#b52a2a", border: "#f0b3b3" },
};

// Only ever true for well-formed http:// or https:// URLs — mirrors
// backend/src/utils/fulfillment.js's isSafeTrackingUrl exactly, so a
// tracking link is never rendered from anything else even if the API
// response were ever tampered with in transit.
export function isSafeTrackingUrl(url) {
  if (typeof url !== "string" || !url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (err) {
    return false;
  }
}

export function formatDateOnly(dateString) {
  if (!dateString) return "—";
  // Date-only values (estimated_delivery_date) come back as YYYY-MM-DD;
  // parsing as UTC avoids a timezone-driven day-shift in the display.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? new Date(`${dateString}T00:00:00Z`)
    : new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: /^\d{4}-\d{2}-\d{2}$/.test(dateString) ? "UTC" : undefined,
  });
}

export function formatDateTime(dateString) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
