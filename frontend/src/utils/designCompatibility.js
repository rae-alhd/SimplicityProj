// Pure helpers for filtering design collections/designs by the customer's
// selected product color and size, using the `variants` array the backend
// attaches to every design (collection_design_variants, already filtered
// to customer-ready rows server-side — active variant, active color, at
// least one active preview image).

// API values may occasionally arrive as strings — compare numerically
// rather than with strict equality on raw ids.
function idsMatch(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) {
    return false;
  }
  return Number(a) === Number(b);
}

/**
 * Resolves the single compatible variant for a design given the selected
 * color and size, or null if none match.
 *
 * hasSizes: whether the product has any configured sizes at all.
 *  - Sized product: allowed_size_ids: [] means every size is allowed;
 *    otherwise selectedSize.id must be one of allowed_size_ids.
 *  - Sizeless product: selectedSize may be null. allowed_size_ids: []
 *    means the standard/no-size option is allowed — no fake size id is
 *    invented or required.
 */
export function getCompatibleVariant(design, selectedColor, selectedSize, hasSizes) {
  if (!design || !selectedColor) return null;

  const matches = (design.variants || []).filter((variant) => {
    if (!idsMatch(variant.color_id, selectedColor.id)) return false;

    const allowedSizeIds = variant.allowed_size_ids || [];

    if (allowedSizeIds.length === 0) {
      // Empty restrictions: all sizes allowed (sized product) or the
      // standard/no-size option is allowed (sizeless product) — either
      // way, nothing further to check.
      return true;
    }

    if (!hasSizes) {
      // A sizeless product should never actually have restriction rows
      // (the backend only allows restricting to sizes that exist for the
      // product) — fail closed rather than assume compatibility.
      return false;
    }

    if (!selectedSize) return false;

    return allowedSizeIds.some((id) => idsMatch(id, selectedSize.id));
  });

  // The backend's UNIQUE(design_id, color_id) constraint means more than
  // one match here would be a data inconsistency, not a normal case. If it
  // ever happens, pick deterministically — the first match in the order
  // the backend already returned.
  return matches[0] || null;
}

export function getCompatibleDesigns(collection, selectedColor, selectedSize, hasSizes) {
  const designs = collection?.designs || [];
  return designs.filter(
    (design) => getCompatibleVariant(design, selectedColor, selectedSize, hasSizes) !== null
  );
}

export function getCompatibleCollections(collections, selectedColor, selectedSize, hasSizes) {
  return (collections || []).filter(
    (collection) =>
      getCompatibleDesigns(collection, selectedColor, selectedSize, hasSizes).length > 0
  );
}
