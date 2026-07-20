-- Migration 006: Phase 2 Performance Indexes & Notification Queue

-- 1. Orders table indexes
ALTER TABLE orders ADD INDEX idx_orders_user_id (user_id);
ALTER TABLE orders ADD INDEX idx_orders_status (status);

-- 2. Order Items table indexes
ALTER TABLE order_items ADD INDEX idx_order_items_order_id (order_id);
ALTER TABLE order_items ADD INDEX idx_order_items_product_id (product_id);

-- 3. Notifications table indexes
ALTER TABLE notifications ADD INDEX idx_notifications_user_read (user_id, is_read);

-- 4. Wallet Transactions table indexes
ALTER TABLE wallet_transactions ADD INDEX idx_wallet_user_created (user_id, created_at);

-- 5. Coupons table indexes
ALTER TABLE coupons ADD INDEX idx_coupons_is_active (is_active);

-- 6. Abandoned Carts table indexes
ALTER TABLE abandoned_carts ADD INDEX idx_abandoned_carts_user_status (user_id, status);

-- 7. Create Notification Queue table
CREATE TABLE IF NOT EXISTS notification_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('email', 'sms') NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    payload JSON,
    status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
    attempts INT DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME DEFAULT NULL,
    INDEX idx_status_scheduled (status, scheduled_at)
);
