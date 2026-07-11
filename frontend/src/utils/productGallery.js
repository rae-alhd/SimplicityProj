// Shared gallery-selection logic for any page that needs to show a
// product's real photos for a given color (ProductDetails, CustomizePage).
// Keep this the single source of truth — do not re-implement filtering
// elsewhere.

function sortImages(images) {
  return [...images].sort((a, b) => {
    if (Boolean(a.is_main) !== Boolean(b.is_main)) {
      return a.is_main ? -1 : 1;
    }
    const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return (a.id ?? 0) - (b.id ?? 0);
  });
}

/**
 * Resolve which images to show for a product + selected color.
 *
 * Priority:
 *  1. Images whose color_id matches selectedColor.id.
 *  2. General images (color_id is null) — no color-specific photos exist.
 *  3. All product images — safe fallback if neither of the above exist.
 *  4. main_image_url / image_url — legacy single-image fallback when the
 *     product has no product_images rows at all.
 *  5. Empty array — nothing to show, caller renders its own placeholder.
 */
export function getActiveGallery(product, selectedColor) {
  const images = product?.images || [];

  if (images.length > 0) {
    const colorImages = selectedColor
      ? images.filter(
          (img) => Number(img.color_id) === Number(selectedColor.id)
        )
      : [];

    if (colorImages.length > 0) {
      return sortImages(colorImages);
    }

    const generalImages = images.filter(
      (img) => img.color_id === null || img.color_id === undefined
    );

    if (generalImages.length > 0) {
      return sortImages(generalImages);
    }

    return sortImages(images);
  }

  const fallbackUrl = product?.main_image_url || product?.image_url || null;

  if (fallbackUrl) {
    return [
      {
        id: "fallback-main-image",
        image_url: fallbackUrl,
        sort_order: 0,
        is_main: true,
        color_id: null,
      },
    ];
  }

  return [];
}
