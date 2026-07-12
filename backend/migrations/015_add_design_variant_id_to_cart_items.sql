-- 015_add_design_variant_id_to_cart_items.sql
-- Adds a nullable reference from cart_items to the exact compatibility
-- variant (design + color, from collection_design_variants) the customer
-- selected, so a cart line preserves "Yemen + Black" precisely instead of
-- relying only on design_id + a free-text color string.
-- Nullable and ON DELETE SET NULL: non-customized and legacy cart rows
-- have no design variant, and deleting/reconfiguring a design in the
-- Design Studio must not delete an existing cart row — checkout-time
-- revalidation of stale/deactivated configurations is a later task.
-- Mirrors the existing cart_items.design_id column added in migration 005.

ALTER TABLE cart_items
  ADD COLUMN design_variant_id INTEGER REFERENCES collection_design_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cart_items_design_variant_id
  ON cart_items(design_variant_id);
