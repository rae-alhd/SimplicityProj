// Task O1: shared shipping & fulfillment helpers. No carrier API is
// integrated — every field is entered manually by the owner, so this file
// only validates/labels what the owner typed, never calls out anywhere.

const SHIPPING_METHOD_LABELS = {
  COURIER: "Courier Delivery",
  PICKUP: "Store Pickup",
  MANUAL: "Manual Delivery",
};

const VALID_SHIPPING_METHODS = Object.keys(SHIPPING_METHOD_LABELS);

const MAX_CARRIER_NAME_LENGTH = 120;
const MAX_TRACKING_NUMBER_LENGTH = 100;
const MAX_TRACKING_URL_LENGTH = 500;
const MAX_PRIVATE_NOTE_LENGTH = 2000;

// Only ever true for well-formed http:// or https:// URLs — rejects
// javascript:, data:, and anything malformed. Used both to validate an
// owner-entered tracking URL server-side and to decide whether it's ever
// safe to hand to a customer.
function isSafeTrackingUrl(url) {
  if (typeof url !== "string" || !url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (err) {
    return false;
  }
}

// Strict YYYY-MM-DD check — anything else (including a technically
// Date-parseable but ambiguous format) is rejected rather than guessed at.
function isValidDateOnlyString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

module.exports = {
  SHIPPING_METHOD_LABELS,
  VALID_SHIPPING_METHODS,
  MAX_CARRIER_NAME_LENGTH,
  MAX_TRACKING_NUMBER_LENGTH,
  MAX_TRACKING_URL_LENGTH,
  MAX_PRIVATE_NOTE_LENGTH,
  isSafeTrackingUrl,
  isValidDateOnlyString,
};
