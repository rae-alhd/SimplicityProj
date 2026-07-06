-- 002_backfill_product_images.sql
-- Backfills product_images from products.image_url for existing products.
-- Idempotent: skips any product that already has at least one row in product_images,
-- so re-running this file does not create duplicates.
-- Does NOT modify or remove products.image_url.

INSERT INTO product_images (product_id, image_url, sort_order, is_main, is_active)
SELECT
  p.id,
  p.image_url,
  0,
  true,
  true
FROM products p
WHERE p.image_url IS NOT NULL
  AND TRIM(p.image_url) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM product_images pi WHERE pi.product_id = p.id
  );
