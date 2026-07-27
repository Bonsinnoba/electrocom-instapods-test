-- Migration 046: Carrier credentials
-- Description: Empty/unconfigured until a real carrier account exists.
-- api_key_encrypted uses the same DATA_ENCRYPTION_KEY pattern already
-- defined in .env for other encrypted fields (see config.php).

CREATE TABLE IF NOT EXISTS carrier_credentials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    carrier_name VARCHAR(100) NOT NULL UNIQUE COMMENT 'e.g. fedex, dhl, ups',
    display_name VARCHAR(150) DEFAULT NULL,
    api_key_encrypted TEXT DEFAULT NULL,
    api_secret_encrypted TEXT DEFAULT NULL,
    account_number VARCHAR(100) DEFAULT NULL,
    sandbox_mode BOOLEAN DEFAULT TRUE,
    is_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
