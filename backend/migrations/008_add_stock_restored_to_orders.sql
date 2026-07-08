-- 008_add_stock_restored_to_orders.sql
-- Tracks whether an order's stock has already been restored after cancellation,
-- so a cancelled order's stock is only ever credited back once — even if the
-- order status is changed to cancelled more than once.
-- Existing rows default to false (stock not yet restored), which is correct
-- for all orders created before this column existed.

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS stock_restored BOOLEAN NOT NULL DEFAULT false;
