-- 013_create_collection_design_variant_sizes.sql
-- Design Studio foundation, table 2 of 3: optional per-variant size
-- restrictions. A collection_design_variants row with zero matching rows
-- here means every one of the product's configured sizes is allowed for
-- that design/color combination — this is the default, and no rows should
-- be created for a variant meant to allow every size. One or more rows
-- narrows the allowed sizes to exactly those listed.
-- This "zero rows = unrestricted" rule also means a future standard-size
-- product (no per-product sizes configured at all) is naturally handled
-- with no special-casing: it simply has zero rows here too, same as any
-- other unrestricted variant.
-- Stores no size labels or standard-size fields of its own — always
-- resolves through the existing customizable_product_sizes table.

CREATE TABLE IF NOT EXISTS collection_design_variant_sizes (
  id SERIAL PRIMARY KEY,
  variant_id INTEGER NOT NULL REFERENCES collection_design_variants(id) ON DELETE CASCADE,
  size_id INTEGER NOT NULL REFERENCES customizable_product_sizes(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (variant_id, size_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_design_variant_sizes_variant_id
  ON collection_design_variant_sizes(variant_id);

CREATE INDEX IF NOT EXISTS idx_collection_design_variant_sizes_size_id
  ON collection_design_variant_sizes(size_id);
