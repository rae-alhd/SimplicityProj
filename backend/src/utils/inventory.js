// Task K3: shared helpers for General vs Variant inventory. Customers must
// never see an exact stock number — every consumer of this module works
// with a computed customer-safe status instead.

// Fixed thresholds given by the business rule (mirrors the frontend's
// pre-existing Cart.jsx getStockAvailability tiers exactly, so the same
// quantity always produces the same customer-facing label everywhere).
function computeAvailabilityStatus(stockQuantity) {
  const qty = Number(stockQuantity || 0);
  if (qty <= 0) return "OUT_OF_STOCK";
  if (qty <= 2) return "ALMOST_GONE";
  if (qty <= 5) return "LOW_STOCK";
  return "AVAILABLE";
}

// Resolves the exact product_inventory_variants row for a VARIANT product
// from its plain-text color/size — the same canonical name-matching
// convention cart_items already uses for color/size (case-insensitive,
// trimmed), so this never trusts a client-supplied id, only currently
// ACTIVE colors/sizes belonging to this exact product.
//
// - If the product has zero active colors, colorName is ignored entirely
//   (colorless products use color_id IS NULL rows; a placeholder string
//   like "Default" sent for such products was never a real color name).
// - Returns { ok: false, error } with a machine-readable error code on any
//   mismatch — callers translate that into the customer-facing message.
async function resolveInventoryVariant(queryable, productId, colorName, sizeLabel) {
  const colorsResult = await queryable.query(
    "SELECT id, color_name FROM customizable_product_colors WHERE product_id = $1 AND is_active = true",
    [productId]
  );
  const hasColors = colorsResult.rows.length > 0;

  let colorId = null;
  if (hasColors) {
    const normalizedColor = String(colorName || "").trim().toLowerCase();
    const match = colorsResult.rows.find(
      (c) => c.color_name.trim().toLowerCase() === normalizedColor
    );
    if (!match) return { ok: false, error: "COLOR_NOT_FOUND" };
    colorId = match.id;
  }

  const sizesResult = await queryable.query(
    "SELECT id, size_label FROM customizable_product_sizes WHERE product_id = $1 AND is_active = true",
    [productId]
  );
  const normalizedSize = String(sizeLabel || "").trim().toLowerCase();
  const sizeMatch = sizesResult.rows.find(
    (s) => s.size_label.trim().toLowerCase() === normalizedSize
  );
  if (!sizeMatch) return { ok: false, error: "SIZE_NOT_FOUND" };
  const sizeId = sizeMatch.id;

  const variantResult =
    colorId !== null
      ? await queryable.query(
          "SELECT id, stock_quantity FROM product_inventory_variants WHERE product_id = $1 AND color_id = $2 AND size_id = $3",
          [productId, colorId, sizeId]
        )
      : await queryable.query(
          "SELECT id, stock_quantity FROM product_inventory_variants WHERE product_id = $1 AND color_id IS NULL AND size_id = $2",
          [productId, sizeId]
        );

  if (variantResult.rows.length === 0) {
    return { ok: false, error: "ROW_MISSING" };
  }

  return {
    ok: true,
    variant: {
      id: variantResult.rows[0].id,
      stock_quantity: variantResult.rows[0].stock_quantity,
      color_id: colorId,
      size_id: sizeId,
    },
  };
}

module.exports = { computeAvailabilityStatus, resolveInventoryVariant };
