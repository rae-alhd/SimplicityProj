-- 018_add_is_gift_to_orders.sql
-- Task J1: lets the customer mark the entire order as a gift at checkout.
-- Whole-order flag only — not per Cart item, no message/wrapping/fee yet
-- (those are explicitly out of scope for this task).
--
-- NOT NULL DEFAULT false so every existing order is preserved as an
-- ordinary non-gift order with no backfill needed.

ALTER TABLE orders
  ADD COLUMN is_gift BOOLEAN NOT NULL DEFAULT false;
