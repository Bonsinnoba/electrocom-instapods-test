-- Migration 008: Granular Order Tracking Timeline
-- Description: Adds a timeline table for micro-status logs and updates picking_tasks statuses.

-- 1. Create order_status_logs table for a chronological timeline
CREATE TABLE IF NOT EXISTS order_status_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    status_key VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order_logs (order_id, created_at)
);

-- 2. Update picking_tasks status enum to support new granular workflow
-- Note: 'received' = picker acknowledged; 'completed' = order dispatched.
ALTER TABLE picking_tasks MODIFY COLUMN status ENUM('pending', 'received', 'picking', 'picked', 'completed', 'missing') DEFAULT 'pending';

-- 3. (Optional) Backfill initial events for processing orders if needed
-- For this implementation, we will log new events moving forward.
