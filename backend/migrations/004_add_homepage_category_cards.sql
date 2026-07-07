-- 004_add_homepage_category_cards.sql
-- Adds Men/Women/Custom Studio category card fields to homepage_settings.
-- All columns are nullable additions; existing row(s) and data are untouched.

ALTER TABLE homepage_settings
  ADD COLUMN men_card_image_url TEXT,
  ADD COLUMN men_card_title TEXT,
  ADD COLUMN women_card_image_url TEXT,
  ADD COLUMN women_card_title TEXT,
  ADD COLUMN studio_card_image_url TEXT,
  ADD COLUMN studio_card_title TEXT;
