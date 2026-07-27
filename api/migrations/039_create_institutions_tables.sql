-- Migration 039: Institutions and institution contacts
-- Description: Institutional (B2B) accounts that can submit quote requests.
-- Institution reps remain normal `users` rows (role = 'customer') and are
-- linked here rather than gaining a new staff role.

CREATE TABLE IF NOT EXISTS institutions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type ENUM('school', 'hospital', 'corporate', 'government', 'ngo', 'other') DEFAULT 'other',
    tax_id VARCHAR(100) DEFAULT NULL,
    billing_address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    status ENUM('pending', 'verified', 'suspended') DEFAULT 'pending',
    verified_by INT DEFAULT NULL,
    verified_at DATETIME DEFAULT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_institutions_status (status)
);

CREATE TABLE IF NOT EXISTS institution_contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    institution_id INT NOT NULL,
    user_id INT NOT NULL,
    title VARCHAR(100) DEFAULT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_institution_user (institution_id, user_id)
);
