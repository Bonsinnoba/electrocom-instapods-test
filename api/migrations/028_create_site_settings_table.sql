-- Create site_settings table for critical configuration storage
-- This moves security, business logic, and operational settings from JSON to database
-- for better security, validation, and data integrity

CREATE TABLE IF NOT EXISTS site_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE COMMENT 'Unique identifier for the setting',
    setting_value TEXT COMMENT 'Setting value (stored as text, validated by application)',
    value_type ENUM('string', 'integer', 'float', 'boolean', 'json') NOT NULL DEFAULT 'string' COMMENT 'Data type for validation',
    category ENUM('security', 'business', 'operational', 'payment', 'delivery') NOT NULL COMMENT 'Setting category for organization',
    description TEXT COMMENT 'Human-readable description of the setting',
    is_public BOOLEAN DEFAULT FALSE COMMENT 'Whether this setting can be exposed to storefront',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_category (category),
    INDEX idx_is_public (is_public),
    INDEX idx_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Critical site configuration settings';

-- Insert default critical settings from current super_settings.json
INSERT INTO site_settings (setting_key, setting_value, value_type, category, description, is_public) VALUES
-- Security settings
('maxLoginAttempts', '5', 'integer', 'security', 'Maximum number of failed login attempts before account lockout', FALSE),
('sessionTimeout', '360', 'integer', 'security', 'Session timeout in minutes', FALSE),
('twoFactorAdmin', 'true', 'boolean', 'security', 'Require two-factor authentication for admin users', FALSE),
('lockoutDuration', '30', 'integer', 'security', 'Account lockout duration in minutes after failed login attempts', FALSE),
('passwordMinLength', '8', 'integer', 'security', 'Minimum password length requirement', FALSE),
('requireEmailVerification', 'false', 'boolean', 'security', 'Require email verification for new user registrations', FALSE),
('requireNumberInPassword', 'false', 'boolean', 'security', 'Require at least one number in passwords', FALSE),
('apiRateLimit', '60', 'integer', 'security', 'API rate limit per minute per IP address', FALSE),
('emailNotify', 'true', 'boolean', 'security', 'Enable email notifications for security events', FALSE),
('securityAlerts', 'true', 'boolean', 'security', 'Enable security alerts and notifications', FALSE),
('debugMode', 'true', 'boolean', 'security', 'Enable debug mode (should be false in production)', FALSE),

-- Business settings
('vatRate', '0', 'float', 'business', 'VAT rate as percentage (e.g., 15 for 15%)', TRUE),
('allowRegistration', 'true', 'boolean', 'business', 'Allow new user registrations', TRUE),
('allowCardPayment', 'true', 'boolean', 'business', 'Allow credit/debit card payments', TRUE),
('lowStockThreshold', '5', 'integer', 'business', 'Low stock threshold for alerts', FALSE),
('lowStockAlertEmail', 'admin@electrocom.gh', 'string', 'business', 'Email address for low stock alerts', FALSE),
('integrityDiscountThreshold', '5000', 'float', 'business', 'Order amount threshold for integrity discount', TRUE),
('integrityDiscountPct', '10', 'float', 'business', 'Integrity discount percentage', TRUE),

-- Operational settings
('backupFrequency', 'daily', 'string', 'operational', 'Database backup frequency (daily, weekly, monthly)', FALSE),
('defaultItemsPerPage', '6', 'integer', 'operational', 'Default number of items per page in product listings', TRUE),
('homepageSectionTitle', '', 'string', 'operational', 'Title for homepage featured section', TRUE),
('homepageFeaturedCategory', 'Featured Products ', 'string', 'operational', 'Featured category for homepage', TRUE),
('orderReceiptFooterNote', 'Thankyou for shopping with ElectroCom', 'string', 'operational', 'Footer note for order receipts', TRUE),

-- Delivery settings
('allowDoorToDoorDelivery', 'false', 'boolean', 'delivery', 'Enable door-to-door delivery option', TRUE),
('doorToDoorThreshold', '400', 'float', 'delivery', 'Order amount threshold for free door-to-door delivery', TRUE),

-- Insights settings
('insightsShipWarnHours', '24', 'integer', 'operational', 'Hours before shipping deadline triggers warning', FALSE),
('insightsShipCriticalHours', '48', 'integer', 'operational', 'Hours before shipping deadline triggers critical alert', FALSE),
('insightsLowStockWarnCount', '5', 'integer', 'operational', 'Low stock count threshold for warning', FALSE),
('insightsLowStockCriticalCount', '12', 'integer', 'operational', 'Low stock count threshold for critical alert', FALSE),
('insightsOnlineRevenueMinPct', '20', 'float', 'operational', 'Minimum percentage of online revenue for insights', FALSE),
('insightsRepeatOrderMin', '1.2', 'float', 'operational', 'Minimum repeat order rate for insights', FALSE),
('insightsWeightShip', '35', 'float', 'operational', 'Weight for shipping metrics in insights calculation', FALSE),
('insightsWeightStock', '25', 'float', 'operational', 'Weight for stock metrics in insights calculation', FALSE),
('insightsWeightOnline', '20', 'float', 'operational', 'Weight for online metrics in insights calculation', FALSE),
('insightsWeightRepeat', '20', 'float', 'operational', 'Weight for repeat order metrics in insights calculation', FALSE)
ON DUPLICATE KEY UPDATE 
    setting_value = VALUES(setting_value),
    updated_at = CURRENT_TIMESTAMP;
