-- 023_reconcile_legacy_order_workflow_data.sql
-- Task M1 follow-up: legacy order-data reconciliation.
--
-- CHECK 1 (order_status_history old_status/new_status values): inspected
-- live before writing this migration — order_status_history currently has
-- ZERO rows in this database. Every real order's history began accumulating
-- only once Task M1's PATCH /:id/status went live; nothing was ever written
-- to this table under the old pending/confirmed/processing status names.
-- There is therefore nothing to remap, and this migration intentionally
-- contains no UPDATE against order_status_history — adding one would be
-- speculative, unused code for data that doesn't exist.
--
-- CHECK 2 (orders.admin_notes legacy single-field notes): inspected live —
-- exactly one nonempty value exists (order id 9: " customer called, wants
-- Friday delivery"). Backfilled below into order_admin_notes with
-- admin_user_id = NULL (original author unknown), using the order's own
-- created_at as the timestamp. orders.admin_notes itself is left in place,
-- untouched, per spec. NOT EXISTS guards against duplicate insertion if
-- this migration is ever re-run.

INSERT INTO order_admin_notes (order_id, admin_user_id, note_text, created_at, updated_at)
SELECT
  o.id,
  NULL,
  TRIM(o.admin_notes),
  o.created_at,
  o.created_at
FROM orders o
WHERE o.admin_notes IS NOT NULL
  AND TRIM(o.admin_notes) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM order_admin_notes n
    WHERE n.order_id = o.id AND n.note_text = TRIM(o.admin_notes)
  );
