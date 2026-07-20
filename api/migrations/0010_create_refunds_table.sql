CREATE TABLE IF NOT EXISTS refunds (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    order_id        INT NOT NULL,
    return_id       INT DEFAULT NULL,
    amount          DECIMAL(10,2) NOT NULL,
    method          VARCHAR(50) NOT NULL COMMENT 'cash | paystack | momo',
    gateway_ref     VARCHAR(150) DEFAULT NULL COMMENT 'Paystack refund ID returned by API',
    status          ENUM('pending','processed','failed') DEFAULT 'pending',
    approved_by     INT NOT NULL,
    note            TEXT DEFAULT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at    DATETIME DEFAULT NULL,
    FOREIGN KEY (order_id)   REFERENCES orders(id)         ON DELETE CASCADE,
    FOREIGN KEY (return_id)  REFERENCES order_returns(id)  ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id)         ON DELETE RESTRICT,
    INDEX idx_refunds_order  (order_id),
    INDEX idx_refunds_status (status),
    INDEX idx_refunds_gateway (gateway_ref)
);
