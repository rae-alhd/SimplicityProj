-- 010_add_admin_notes_to_orders.sql
-- Adds an admin-only notes field to orders, separate from the customer's
-- own checkout `notes` field, so the owner can record internal context
-- (e.g. "customer called, wants Friday delivery") without overwriting
-- anything the customer submitted.
-- Nullable: existing orders simply have no admin notes yet.

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS admin_notes TEXT;
