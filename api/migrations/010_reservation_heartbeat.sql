-- api/migrations/010_reservation_heartbeat.sql

-- 1. Add last_activity_at to track when the user's checkout session was last active.
-- If no heartbeat is received within 2 minutes, we consider the window closed.
ALTER TABLE orders ADD COLUMN last_activity_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER reserved_at;

-- 2. Index for performance during heartbeat cleanup
CREATE INDEX idx_orders_heartbeat ON orders (status, last_activity_at);
