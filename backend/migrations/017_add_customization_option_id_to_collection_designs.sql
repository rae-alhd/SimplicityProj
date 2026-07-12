-- 017_add_customization_option_id_to_collection_designs.sql
-- Task I1: lets the owner assign the customization option/placement
-- (e.g. "Front Center") directly to each design, so the customer no
-- longer has to independently pick a placement that might conflict
-- with what the design was actually designed for.
--
-- Nullable and ON DELETE SET NULL:
--   - existing designs must survive this migration unaffected
--   - legacy/incomplete designs may not have a placement assigned yet
--     (Task I1 does not hide or deactivate them for this reason)
--   - deleting a customization_options row must never delete the design
--     it's attached to, matching the existing collection_design_variants
--     -> customizable_product_colors ON DELETE SET NULL convention

ALTER TABLE collection_designs
  ADD COLUMN customization_option_id INTEGER
    REFERENCES customization_options(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_collection_designs_customization_option_id
  ON collection_designs(customization_option_id);
