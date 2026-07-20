-- api/migrations/009_order_reservations.sql

-- 1. Add reserved_at to track when a soft reservation started.
-- We use this instead of created_at because an order might be retried or reset.
ALTER TABLE orders ADD COLUMN reserved_at TIMESTAMP NULL DEFAULT NULL AFTER payment_reference;

-- 2. Index for performance during expiration checks
CREATE INDEX idx_orders_reservation ON orders (status, reserved_at);
