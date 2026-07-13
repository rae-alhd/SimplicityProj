-- 024_create_payments.sql
-- Task N1: payment status lifecycle. No real payment gateway is integrated
-- in this project — payments are recorded manually by the owner.
--
-- Inspected first: no payments-related table existed anywhere in this
-- database (checked pg_tables directly, not just the migrations folder,
-- since this project has previously had schema that predates its migration
-- files). This is a greenfield addition.
--
-- One payment record per order (UNIQUE on order_id) — the simplest model
-- that fits a no-gateway, manually-recorded payment system; there is no
-- concept of multiple payment attempts here since nothing is actually
-- charged automatically.

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  payment_method VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
    CHECK (payment_method IN ('CASH_ON_DELIVERY', 'BANK_TRANSFER', 'MANUAL')),
  transaction_reference TEXT,
  paid_at TIMESTAMP,
  failed_at TIMESTAMP,
  refunded_at TIMESTAMP,
  failure_reason TEXT,
  refund_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Append-only audit trail, mirroring order_status_history's shape/FK
-- behavior: changed_by is nullable (migration-created rows have no admin
-- author) and SET NULL on admin-account deletion so payment history always
-- survives; order_id/payment_id both CASCADE so deleting an order cleans
-- up its payment trail exactly like it already does for order_status_history
-- and order_admin_notes.
CREATE TABLE IF NOT EXISTS payment_status_history (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status VARCHAR(10),
  new_status VARCHAR(10) NOT NULL,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  change_note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_status_history_order_id
  ON payment_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_status_history_payment_id
  ON payment_status_history(payment_id);

-- Legacy backfill: every existing order predates this table and has no
-- payment record at all. Per spec, do not infer PAID merely because an
-- order is already delivered, and do not invent a transaction reference —
-- every backfilled row is a safe PENDING/MANUAL placeholder. No matching
-- payment_status_history row is created for these (consistent with Task
-- M1's order_status_history, which never synthesizes a row for an order's
-- initial state either — the customer/admin timeline reconstructs the
-- initial "Pending Payment" moment from payments.created_at instead).
INSERT INTO payments (order_id, status, payment_method)
SELECT o.id, 'PENDING', 'MANUAL'
FROM orders o
WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id);
