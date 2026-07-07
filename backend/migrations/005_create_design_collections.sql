-- 005_create_design_collections.sql
-- Adds the Design Collections System: per-product collections (e.g. "Country")
-- containing individual designs (e.g. "Yemen", "Saudi"), plus the fields needed
-- to save a customer's chosen design on cart items and orders.
-- All additions are new tables or nullable columns; no existing data is touched,
-- and existing customization_options / customization_examples are untouched.

CREATE TABLE design_collections (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_design_collections_product_id ON design_collections(product_id);

CREATE TABLE collection_designs (
  id SERIAL PRIMARY KEY,
  collection_id INTEGER NOT NULL REFERENCES design_collections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_collection_designs_collection_id ON collection_designs(collection_id);

ALTER TABLE cart_items
  ADD COLUMN design_id INTEGER REFERENCES collection_designs(id) ON DELETE SET NULL;

CREATE INDEX idx_cart_items_design_id ON cart_items(design_id);

ALTER TABLE order_items
  ADD COLUMN design_label TEXT;
