-- Migration 047: Delivery provider settings
-- Description: Extends the existing site_settings 'delivery' category
-- (see 028_create_site_settings_table.sql) with provider-switching config,
-- instead of introducing a parallel settings table.

INSERT INTO site_settings (setting_key, setting_value, value_type, category, description, is_public) VALUES
('activeDeliveryProviderMode', 'self_fleet', 'string', 'delivery', 'Which provider mode fulfills door-to-door orders: self_fleet, carrier, or both (zone-routed)', FALSE),
('selfFleetEnabled', 'true', 'boolean', 'delivery', 'Whether the self-owned fleet is currently operational', FALSE),
('carrierFallbackEnabled', 'false', 'boolean', 'delivery', 'Whether to fall back to a carrier when no self-fleet zone/rider is available', FALSE)
ON DUPLICATE KEY UPDATE
    setting_value = VALUES(setting_value),
    updated_at = CURRENT_TIMESTAMP;
