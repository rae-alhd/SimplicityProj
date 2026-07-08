-- 009_create_store_settings.sql
-- Adds a single-row store_settings table for admin-configurable store-wide
-- values, starting with low_stock_threshold (used to flag "Low stock" on
-- products in AdminProducts.jsx instead of a hardcoded 5).
-- Single row by convention: the application always reads/writes id = 1.

CREATE TABLE IF NOT EXISTS store_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 1),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO store_settings (id, low_stock_threshold)
VALUES (1, 5)
ON CONFLICT DO NOTHING;
