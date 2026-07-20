CREATE TABLE IF NOT EXISTS email_queue (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    template_key VARCHAR(120) NOT NULL,
    subject VARCHAR(255) DEFAULT NULL,
    payload_json JSON DEFAULT NULL,
    status ENUM('pending', 'retrying', 'sent', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    last_error TEXT DEFAULT NULL,
    scheduled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME DEFAULT NULL,
    processed_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email_queue_status_schedule (status, scheduled_at),
    INDEX idx_email_queue_recipient (recipient_email)
);

CREATE TABLE IF NOT EXISTS email_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) DEFAULT NULL,
    provider VARCHAR(50) DEFAULT 'smtp',
    provider_message_id VARCHAR(190) DEFAULT NULL,
    status ENUM('sent', 'failed') NOT NULL,
    error_message TEXT DEFAULT NULL,
    meta_json JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email_log_recipient_created (recipient_email, created_at)
);

CREATE TABLE IF NOT EXISTS email_suppressions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    reason VARCHAR(100) DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
