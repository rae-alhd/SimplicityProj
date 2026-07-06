-- 001_create_product_images.sql
-- Adds multi-image support for products.
-- Does NOT modify or remove products.image_url (kept for backward compatibility).

CREATE TABLE product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_main BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_images_product_id ON product_images(product_id);

-- Ensures at most one main image per product
CREATE UNIQUE INDEX one_main_image_per_product
  ON product_images(product_id) WHERE is_main = true;
