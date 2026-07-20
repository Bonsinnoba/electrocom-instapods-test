-- Create revoked_tokens table for JWT token invalidation
-- This fixes the stateless token invalidation security gap
-- When users logout, tokens are added to this blacklist to prevent reuse

CREATE TABLE IF NOT EXISTS revoked_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token_signature VARCHAR(255) NOT NULL COMMENT 'Hash of the JWT token signature for quick lookup',
    user_id INT NOT NULL COMMENT 'User ID who owned this token',
    expires_at DATETIME NOT NULL COMMENT 'When this token would have naturally expired (for cleanup)',
    revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When the token was revoked',
    
    INDEX idx_signature (token_signature),
    INDEX idx_expires_at (expires_at),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
