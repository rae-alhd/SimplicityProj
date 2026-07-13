-- 020_add_inventory_snapshot_to_order_items.sql
-- Task K3: lets a placed order remember which inventory mechanism (GENERAL
-- vs VARIANT) actually controlled its stock at checkout time, and exactly
-- which product_inventory_variants row was deducted — needed so
-- cancellation/restock later restores stock to the right place even if the
-- product's inventory_mode or matrix has since changed.
--
-- order_items.color / order_items.size already exist as the permanent
-- human-readable snapshot (Task H2's convention) — this does not duplicate
-- them, it only adds the inventory-mechanism bookkeeping needed to reverse
-- a VARIANT deduction correctly.
--
-- Nullable, ON DELETE SET NULL: legacy order_items (everything placed
-- before this migration) get inventory_mode_snapshot = NULL, which
-- cancellation logic treats identically to 'GENERAL' — preserving exactly
-- today's restock behavior for every existing order. Deleting the
-- referenced variant/color/size/product later must never delete or corrupt
-- a historical order line (same convention as design_variant_id).

ALTER TABLE order_items
  ADD COLUMN inventory_mode_snapshot VARCHAR(10),
  ADD COLUMN inventory_variant_id INTEGER
    REFERENCES product_inventory_variants(id) ON DELETE SET NULL;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_inventory_mode_snapshot_check
  CHECK (inventory_mode_snapshot IS NULL OR inventory_mode_snapshot IN ('GENERAL', 'VARIANT'));

CREATE INDEX IF NOT EXISTS idx_order_items_inventory_variant_id
  ON order_items(inventory_variant_id);
