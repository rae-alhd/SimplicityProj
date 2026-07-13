-- 021_add_sizing_mode_to_products.sql
-- Task L1: lets a product either use real selectable sizes (MULTI_SIZE) or
-- one admin-defined standard label with no size rows at all (STANDARD).
--
-- Backfill runs BEFORE the CHECK constraint is added, so every existing
-- row (including the ones about to become STANDARD) already satisfies it
-- by the time the constraint starts validating.

ALTER TABLE products
  ADD COLUMN sizing_mode VARCHAR(10) NOT NULL DEFAULT 'MULTI_SIZE'
    CHECK (sizing_mode IN ('MULTI_SIZE', 'STANDARD')),
  ADD COLUMN standard_size_label TEXT;

-- Products with zero currently-active configured sizes never had a real
-- size selector to begin with — backfill them to STANDARD with the
-- existing convention's exact customer-facing label, "One Size", rather
-- than inventing a fake size row. Products with at least one active size
-- stay MULTI_SIZE (the column default already covers this — no UPDATE
-- needed for them).
UPDATE products p
SET sizing_mode = 'STANDARD',
    standard_size_label = 'One Size'
WHERE NOT EXISTS (
  SELECT 1
  FROM customizable_product_sizes s
  WHERE s.product_id = p.id AND s.is_active = true
);

-- STANDARD always needs a real, nonblank label; MULTI_SIZE never requires
-- one (it may be null, or retain a stale label from a prior STANDARD
-- period — Task L1 lets the admin route choose whether to clear it).
ALTER TABLE products
  ADD CONSTRAINT products_standard_size_label_check
  CHECK (
    sizing_mode = 'MULTI_SIZE'
    OR (standard_size_label IS NOT NULL AND length(trim(standard_size_label)) > 0)
  );

-- Task L1: permanent record of the standard label a customer actually saw
-- at checkout, so a later rename of standard_size_label never changes what
-- an already-placed order displays. Null for MULTI_SIZE order lines,
-- matching every other snapshot field's convention in this table.
ALTER TABLE order_items
  ADD COLUMN standard_size_label_snapshot TEXT;
