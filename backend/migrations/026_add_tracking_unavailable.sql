-- 026_add_tracking_unavailable.sql
-- Task O1 correction: migration 025's order_fulfillment table has no field
-- to distinguish "tracking number was forgotten" from "the owner explicitly
-- confirmed tracking is genuinely unavailable for this Courier shipment" —
-- the PATCH /:id/status handler accepted a tracking_unavailable flag in the
-- request body to WAIVE the tracking_number requirement, but never
-- persisted it anywhere. Confirmed via information_schema before writing
-- this migration: order_fulfillment has no such column.
--
-- Additive only — migration 025 is left untouched. Defaults to FALSE, so
-- all 10 existing real fulfillment rows simply gain this one new column at
-- its safe default; nothing else about them changes.

ALTER TABLE order_fulfillment
ADD COLUMN IF NOT EXISTS tracking_unavailable BOOLEAN NOT NULL DEFAULT FALSE;
