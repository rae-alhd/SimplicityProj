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

/* ─────────────────────────────────────────────
   Task P1: relocated here from orders.routes.js (unchanged) so the
   fulfillment validation rules live in the same shared-utils pattern as
   backend/src/utils/orderStatus.js and paymentStatus.js — and so they can
   be unit-tested directly, without duplicating the rules inside a test
   file. Still used by both the standalone PATCH /:orderId/fulfillment
   endpoint and the Ready -> Shipped transition in orders.routes.js.

   Field-level validation for whichever fulfillment fields are present in a
   request body. Only validates/normalizes fields that were actually
   provided (key present, not undefined); anything absent is left out of
   the returned `fields` object entirely so callers can tell "not sent"
   apart from "explicitly cleared."
───────────────────────────────────────────── */
function validateFulfillmentInput(body) {
  const fields = {};

  if (body.shipping_method !== undefined) {
    if (!VALID_SHIPPING_METHODS.includes(body.shipping_method)) {
      return {
        ok: false,
        error: `shipping_method must be one of: ${VALID_SHIPPING_METHODS.join(", ")}`,
      };
    }
    fields.shipping_method = body.shipping_method;
  }

  if (body.carrier_name !== undefined) {
    const trimmed = typeof body.carrier_name === "string" ? body.carrier_name.trim() : "";
    if (trimmed.length > MAX_CARRIER_NAME_LENGTH) {
      return {
        ok: false,
        error: `carrier_name must be ${MAX_CARRIER_NAME_LENGTH} characters or fewer.`,
      };
    }
    fields.carrier_name = trimmed || null;
  }

  if (body.tracking_number !== undefined) {
    const trimmed = typeof body.tracking_number === "string" ? body.tracking_number.trim() : "";
    if (trimmed.length > MAX_TRACKING_NUMBER_LENGTH) {
      return {
        ok: false,
        error: `tracking_number must be ${MAX_TRACKING_NUMBER_LENGTH} characters or fewer.`,
      };
    }
    fields.tracking_number = trimmed || null;
  }

  if (body.tracking_url !== undefined) {
    const trimmed = typeof body.tracking_url === "string" ? body.tracking_url.trim() : "";
    if (!trimmed) {
      fields.tracking_url = null;
    } else if (trimmed.length > MAX_TRACKING_URL_LENGTH) {
      return {
        ok: false,
        error: `tracking_url must be ${MAX_TRACKING_URL_LENGTH} characters or fewer.`,
      };
    } else if (!isSafeTrackingUrl(trimmed)) {
      // Rejects javascript:, data:, and any other malformed/unsafe value —
      // only well-formed http:// or https:// URLs are ever accepted.
      return {
        ok: false,
        error: "tracking_url must be a valid http:// or https:// link.",
      };
    } else {
      fields.tracking_url = trimmed;
    }
  }

  if (body.estimated_delivery_date !== undefined) {
    if (body.estimated_delivery_date === null || body.estimated_delivery_date === "") {
      fields.estimated_delivery_date = null;
    } else if (!isValidDateOnlyString(body.estimated_delivery_date)) {
      return {
        ok: false,
        error: "estimated_delivery_date must be a valid date (YYYY-MM-DD).",
      };
    } else {
      fields.estimated_delivery_date = body.estimated_delivery_date;
    }
  }

  if (body.private_note !== undefined) {
    const trimmed = typeof body.private_note === "string" ? body.private_note.trim() : "";
    if (trimmed.length > MAX_PRIVATE_NOTE_LENGTH) {
      return {
        ok: false,
        error: `private_note must be ${MAX_PRIVATE_NOTE_LENGTH} characters or fewer.`,
      };
    }
    fields.private_note = trimmed || null;
  }

  // Task O1 correction: must be a real boolean — an arbitrary truthy value
  // (e.g. the string "true") is never silently coerced, it's rejected.
  if (body.tracking_unavailable !== undefined) {
    if (typeof body.tracking_unavailable !== "boolean") {
      return {
        ok: false,
        error: "tracking_unavailable must be a boolean.",
      };
    }
    fields.tracking_unavailable = body.tracking_unavailable;
  }

  return { ok: true, fields };
}

// Business rules specific to actually marking an order Shipped — separate
// from the generic field validation above, since a plain fulfillment edit
// (PATCH /:orderId/fulfillment) never requires any of this.
function validateReadyToShippedRequirements(fields, trackingUnavailable) {
  if (!fields.shipping_method) {
    return {
      ok: false,
      error: "shipping_method is required to mark an order as Shipped.",
    };
  }

  if (fields.shipping_method === "COURIER") {
    if (!fields.carrier_name) {
      return {
        ok: false,
        error: "carrier_name is required for Courier shipments.",
      };
    }
    if (!fields.tracking_number && !trackingUnavailable) {
      return {
        ok: false,
        error:
          "tracking_number is required for Courier shipments unless tracking is explicitly marked unavailable.",
      };
    }
  }

  return { ok: true };
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
  validateFulfillmentInput,
  validateReadyToShippedRequirements,
};
