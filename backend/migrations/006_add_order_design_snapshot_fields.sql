-- 006_add_order_design_snapshot_fields.sql
-- Adds collection_name and design_image_url snapshot fields to order_items,
-- so order history can display the chosen design's collection and photo
-- without depending on the current state of design_collections/collection_designs.
-- Both columns are nullable additions; existing order_items rows and the
-- existing design_label column are untouched.

ALTER TABLE order_items
  ADD COLUMN collection_name TEXT,
  ADD COLUMN design_image_url TEXT;
