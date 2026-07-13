-- 025_add_order_fulfillment.sql
-- Task O1: shipping & fulfillment. No carrier API is integrated — every
-- field here is entered manually by the owner.
--
-- Inspected first: no shipping/carrier/tracking/delivery table or column
-- existed anywhere in this database (checked pg_tables and orders' own
-- columns directly). orders.address is the only existing "shipping
-- address" field, already used by checkout — not duplicated here.
-- Pre-migration state (live, inspected before writing this file):
--   total orders = 10
--   orders currently 'shipped'   = 0
--   orders currently 'delivered' = 5
--   existing tracking/carrier/shipping data = none
--   unexpected delivery-related fields = none
--
-- One fulfillment record per order (UNIQUE on order_id), mirroring the
-- payments table's 1:1 design from migration 024 — there is no concept of
-- multiple shipments per order here.

CREATE TABLE IF NOT EXISTS order_fulfillment (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  shipping_method VARCHAR(10)
    CHECK (shipping_method IS NULL OR shipping_method IN ('COURIER', 'PICKUP', 'MANUAL')),
  carrier_name TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  estimated_delivery_date DATE,
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  private_note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_order_fulfillment_order_id
  ON order_fulfillment(order_id);

-- Legacy backfill: every existing order (including the 5 already
-- 'delivered' ones) predates this table. Per spec, nothing is invented —
-- shipping_method/carrier_name/tracking_number/shipped_at/delivered_at all
-- stay NULL. A delivered order's real shipped/delivered timestamps are
-- simply unknown history, not reconstructed from created_at or guessed.
INSERT INTO order_fulfillment (order_id)
SELECT o.id
FROM orders o
WHERE NOT EXISTS (SELECT 1 FROM order_fulfillment f WHERE f.order_id = o.id);
