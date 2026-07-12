-- 016_add_design_variant_snapshot_to_order_items.sql
-- Preserves the exact design/color compatibility variant a customer
-- ordered, plus the specific per-color preview image they saw, so a
-- completed order remains historically accurate even after the owner
-- renames/deactivates/deletes the underlying Design Studio configuration.
--
-- Deliberately NOT added, because an equivalent already exists and is
-- already populated as a snapshot at order-creation time:
--   - product_name_snapshot   -> order_items.product_name already exists
--   - customization_option_name_snapshot -> order_items.customization_label
--     already exists (sourced from customization_options.option_label)
--   - design_name_snapshot    -> order_items.design_label already exists
--     (sourced from collection_designs.name)
--   - design_color_name_snapshot -> order_items.color / chosen_color
--     already exist and, for design-linked items, already hold the
--     canonical variant color name (enforced at Cart-add time by the
--     Task H1 Cart validation, and re-verified at checkout by Task H2)
--
-- design_variant_id is nullable and ON DELETE SET NULL, matching the
-- existing cart_items.design_variant_id / cart_items.design_id
-- convention: deleting a Design Studio row must never delete or corrupt
-- a historical order line. design_color_id_snapshot and
-- design_preview_image_url_snapshot are plain nullable columns that are
-- never touched again after insert, so they remain correct even once
-- design_variant_id itself has been nulled out by a later deletion.

ALTER TABLE order_items
  ADD COLUMN design_variant_id INTEGER REFERENCES collection_design_variants(id) ON DELETE SET NULL,
  ADD COLUMN design_color_id_snapshot INTEGER REFERENCES customizable_product_colors(id) ON DELETE SET NULL,
  ADD COLUMN design_preview_image_url_snapshot TEXT;

CREATE INDEX IF NOT EXISTS idx_order_items_design_variant_id
  ON order_items(design_variant_id);
