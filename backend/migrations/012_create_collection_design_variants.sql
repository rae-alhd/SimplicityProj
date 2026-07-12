-- 012_create_collection_design_variants.sql
-- Design Studio foundation, table 1 of 3: which (design, color) combinations
-- are allowed to be customized together (e.g. "Yemen" on Black, "Yemen" on
-- White). A design's product is resolved via design -> collection -> product
-- (design_collections.product_id) — every collection already belongs to
-- exactly one product, so product_id is intentionally NOT duplicated here.
-- The backend will later validate (at insert time) that color_id belongs to
-- the product associated with the design's collection.
-- Additive only: existing collection_designs rows are untouched and remain
-- fully valid with zero compatibility rows here — no design requires any
-- row in this table to keep working exactly as it does today.

CREATE TABLE IF NOT EXISTS collection_design_variants (
  id SERIAL PRIMARY KEY,
  design_id INTEGER NOT NULL REFERENCES collection_designs(id) ON DELETE CASCADE,
  color_id INTEGER NOT NULL REFERENCES customizable_product_colors(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (design_id, color_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_design_variants_design_id
  ON collection_design_variants(design_id);

CREATE INDEX IF NOT EXISTS idx_collection_design_variants_color_id
  ON collection_design_variants(color_id);
