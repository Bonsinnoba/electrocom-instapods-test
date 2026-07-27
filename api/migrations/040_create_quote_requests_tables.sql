-- Migration 040: Quote requests (institution-initiated RFQs)

CREATE TABLE IF NOT EXISTS quote_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    institution_id INT NOT NULL,
    submitted_by INT NOT NULL,
    status ENUM('draft', 'submitted', 'under_review', 'quoted', 'accepted', 'rejected', 'expired') DEFAULT 'draft',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_quote_requests_status (status),
    INDEX idx_quote_requests_institution (institution_id)
);

CREATE TABLE IF NOT EXISTS quote_request_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quote_request_id INT NOT NULL,
    product_id INT DEFAULT NULL,
    quantity INT NOT NULL DEFAULT 1,
    notes TEXT,
    FOREIGN KEY (quote_request_id) REFERENCES quote_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    INDEX idx_quote_request_items_request (quote_request_id)
);
