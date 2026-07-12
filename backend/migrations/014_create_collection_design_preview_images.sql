-- 014_create_collection_design_preview_images.sql
-- Design Studio foundation, table 3 of 3: multiple ordered preview images
-- for one (design, color) compatibility row — e.g. front/back/close-up
-- photos of "Yemen" actually printed on the black hoodie. Mirrors the
-- existing product_images table's shape and its one-main-image-per-parent
-- partial unique index exactly, for the same reasons.
-- collection_designs.image_url remains the general design-card thumbnail
-- shown before a color is chosen (untouched, unrelated). This table is the
-- real product/color-specific design gallery shown once a customer has
-- picked a compatible product, color, and design together.

CREATE TABLE IF NOT EXISTS collection_design_preview_images (
  id SERIAL PRIMARY KEY,
  variant_id INTEGER NOT NULL REFERENCES collection_design_variants(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_main BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collection_design_preview_images_variant_id
  ON collection_design_preview_images(variant_id);

-- Ensures at most one main preview image per variant, while allowing any
-- number of non-main images (mirrors product_images' own
-- one_main_image_per_product partial unique index exactly).
CREATE UNIQUE INDEX IF NOT EXISTS one_main_preview_image_per_variant
  ON collection_design_preview_images(variant_id) WHERE is_main = true;
