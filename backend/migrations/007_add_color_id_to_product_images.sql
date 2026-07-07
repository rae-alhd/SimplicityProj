-- 007_add_color_id_to_product_images.sql
-- Adds optional color-specific image support to product_images.
-- color_id is nullable: existing rows (and any future image with no color
-- selected) keep color_id = NULL, meaning "general image, not tied to a
-- specific color" — today's exact behavior is unchanged.
-- is_main and all other existing columns/data are untouched.

ALTER TABLE product_images
  ADD COLUMN color_id INTEGER REFERENCES customizable_product_colors(id) ON DELETE SET NULL;

CREATE INDEX idx_product_images_color_id ON product_images(color_id);
