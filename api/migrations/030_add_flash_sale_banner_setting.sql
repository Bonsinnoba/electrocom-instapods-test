-- Add flash sale banner enabled setting to site_settings table

INSERT INTO site_settings (setting_key, setting_value, value_type, category, description, is_public) VALUES
('flashSaleBannerEnabled', 'true', 'boolean', 'content', 'Enable/disable flash sale banner on homepage', TRUE)
ON DUPLICATE KEY UPDATE 
    setting_value = VALUES(setting_value),
    value_type = VALUES(value_type),
    category = VALUES(category),
    is_public = VALUES(is_public),
    updated_at = CURRENT_TIMESTAMP;
