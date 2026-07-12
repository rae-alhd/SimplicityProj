-- 019_create_product_inventory_variants.sql
-- Task K1: database foundation for stock tracked per color+size combination,
-- alongside the existing whole-product stock_quantity.
--
-- No equivalent table already existed (inspected: cart_items, order_items,
-- product_images, customizable_product_colors/sizes, collection_design_*,
-- customization_options/examples — none track per-combination stock).
--
-- inventory_mode defaults every existing product to GENERAL, so
-- products.stock_quantity remains each product's source of truth exactly
-- as before — nothing here changes existing read/write behavior until a
-- product is explicitly switched to VARIANT via the new mode-switch route.
ALTER TABLE products
  ADD COLUMN inventory_mode VARCHAR(10) NOT NULL DEFAULT 'GENERAL'
    CHECK (inventory_mode IN ('GENERAL', 'VARIANT'));

-- One row per product/color/size stock combination. Deliberately CASCADE
-- (not SET NULL) on all three FKs — this is a live configuration table,
-- the same convention already used by collection_design_variants /
-- collection_design_variant_sizes for the equivalent color/size
-- compatibility rows. Unlike order_items/cart_items, nothing here is a
-- historical customer-facing snapshot, so there's no reason for a row to
-- outlive the product/color/size it describes.
CREATE TABLE product_inventory_variants (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_id INTEGER REFERENCES customizable_product_colors(id) ON DELETE CASCADE,
  size_id INTEGER NOT NULL REFERENCES customizable_product_sizes(id) ON DELETE CASCADE,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_product_inventory_variants_product_id
  ON product_inventory_variants(product_id);

-- Partial unique indexes (Postgres has no direct way to make a regular
-- UNIQUE constraint treat NULL color_id as a single group, so this is the
-- standard way to express "unique product+color+size when color is set,
-- unique product+size when it isn't"):
CREATE UNIQUE INDEX uniq_inventory_variant_with_color
  ON product_inventory_variants(product_id, color_id, size_id)
  WHERE color_id IS NOT NULL;

CREATE UNIQUE INDEX uniq_inventory_variant_no_color
  ON product_inventory_variants(product_id, size_id)
  WHERE color_id IS NULL;
