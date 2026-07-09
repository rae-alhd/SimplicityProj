-- 011_create_order_status_history.sql
-- Adds an append-only audit trail of order status transitions, so admins can
-- see a timeline (Pending -> Confirmed -> Delivered/Cancelled) per order.
-- Rows are inserted alongside the existing status-update transaction in
-- orders.routes.js; this migration only creates the table.

CREATE TABLE IF NOT EXISTS order_status_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id
  ON order_status_history(order_id);
