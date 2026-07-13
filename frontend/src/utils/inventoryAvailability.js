// Task K3: shared customer-facing helpers for General vs Variant inventory.
// Never exposes or computes an exact quantity — every consumer works with
// the backend's precomputed status label only.

export const AVAILABILITY_LABELS = {
  AVAILABLE: "Available",
  LOW_STOCK: "Low stock",
  ALMOST_GONE: "Almost gone",
  OUT_OF_STOCK: "Out of stock",
};

export function availabilityLabel(status) {
  return AVAILABILITY_LABELS[status] || "Out of stock";
}

// Finds the exact combination row for a color+size pair. colorId may be
// null for a colorless (size-only) Variant product. Returns null if the
// combination isn't in the response at all (never invented/assumed).
export function findCombination(combinations, colorId, sizeId) {
  if (!Array.isArray(combinations)) return null;

  return (
    combinations.find((c) => {
      const colorMatches =
        c.color_id === null
          ? colorId === null || colorId === undefined
          : Number(c.color_id) === Number(colorId);
      return colorMatches && Number(c.size_id) === Number(sizeId);
    }) || null
  );
}

// A missing combination (no row in the response) is unavailable — an
// incomplete Variant matrix never falls back to "assume it's fine."
export function getCombinationAvailability(combinations, colorId, sizeId) {
  const combo = findCombination(combinations, colorId, sizeId);
  if (!combo) {
    return { is_available: false, availability_status: "OUT_OF_STOCK" };
  }
  return {
    is_available: combo.is_available,
    availability_status: combo.availability_status,
  };
}
