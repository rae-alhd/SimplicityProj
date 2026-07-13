-- 022_add_order_production_workflow.sql
-- Task M1: replaces the old pending/confirmed/delivered/cancelled status
-- model with the real Simplicity production workflow:
--   new -> design_review -> in_production -> ready -> shipped -> delivered
--   (any of new/design_review/in_production/ready -> cancelled)
--
-- Backfill mapping, based on the live data actually found in this database
-- (status counts inspected before writing this migration: pending=3,
-- confirmed=1, delivered=5, cancelled=1 — 'processing'/'shipped' never
-- existed here):
--   pending   -> new             (order just placed, untouched by admin yet)
--   confirmed -> in_production   (this project's own "admin has started
--                                  working on it" step; closest real
--                                  equivalent to the new in_production stage)
--   delivered -> delivered       (unchanged)
--   cancelled -> cancelled       (unchanged)
--
-- Also adds order_status_history.changed_by (nullable, additive) and
-- creates the order_admin_notes table (private, multi-note, owner-only).

-- 1. Drop the old CHECK constraint FIRST — it only allows the old
--    pending/confirmed/delivered/cancelled values, so backfilling to 'new'/
--    'in_production' below would violate it if it were still in place.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- 2. Backfill existing status values to their new equivalents.
UPDATE orders SET status = 'new' WHERE status = 'pending';
UPDATE orders SET status = 'in_production' WHERE status = 'confirmed';

-- 3. Add the new status CHECK constraint now that every row already
--    satisfies it.
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('new', 'design_review', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled'));

ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'new';

-- 4. Status history: who made the change, if known. Nullable so every
-- historical row (and any future system-initiated change) stays valid.
ALTER TABLE order_status_history
  ADD COLUMN IF NOT EXISTS changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 5. Private, multi-entry admin notes. Separate from the existing single
-- orders.admin_notes TEXT column (migration 010), which is left in place
-- untouched — this table is the new, richer note system used going
-- forward. Deleting an admin account must not delete the order or silently
-- destroy its notes' history, so admin_user_id uses ON DELETE SET NULL;
-- deleting an order legitimately deletes its own notes (ON DELETE CASCADE),
-- consistent with order_items/order_status_history.
CREATE TABLE IF NOT EXISTS order_admin_notes (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note_text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_admin_notes_order_id
  ON order_admin_notes(order_id);
