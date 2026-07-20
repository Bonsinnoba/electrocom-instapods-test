-- Create webhook_events table for reliable webhook processing with DLQ pattern
-- This prevents webhook silent death by storing events before processing
-- and enabling retry of failed/incomplete webhook processing

CREATE TABLE IF NOT EXISTS webhook_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    event_id VARCHAR(255) NOT NULL COMMENT 'Unique ID from the webhook provider (e.g., Paystack event ID)',
    payload JSON NOT NULL COMMENT 'Full webhook payload',
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    error_message TEXT,
    attempts INT DEFAULT 0,
    processed_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uniq_event_id (event_id),
    INDEX idx_status_created (status, created_at),
    INDEX idx_event_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
