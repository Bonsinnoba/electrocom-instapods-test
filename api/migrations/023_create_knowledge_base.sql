-- Knowledge Base Table for Live Chat Q&A System
CREATE TABLE IF NOT EXISTS knowledge_base (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    question VARCHAR(500) NOT NULL,
    question_normalized VARCHAR(500) NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    keywords JSON DEFAULT NULL,
    usage_count INT DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active TINYINT(1) DEFAULT 1,
    INDEX idx_question_normalized (question_normalized),
    INDEX idx_category (category),
    INDEX idx_is_active (is_active),
    INDEX idx_usage_count (usage_count DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table to track question attempts and learn from them
CREATE TABLE IF NOT EXISTS question_attempts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_question VARCHAR(500) NOT NULL,
    user_question_normalized VARCHAR(500) NOT NULL,
    matched_kb_id BIGINT DEFAULT NULL,
    was_helpful TINYINT(1) DEFAULT NULL,
    redirected_to_admin TINYINT(1) DEFAULT 0,
    admin_answer_id BIGINT DEFAULT NULL,
    user_id INT DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_question_normalized (user_question_normalized),
    INDEX idx_matched_kb_id (matched_kb_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
