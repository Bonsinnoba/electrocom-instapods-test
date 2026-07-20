-- Add branding and identity settings to site_settings table
-- This migrates settings from JSON file to database for centralized storage with caching

-- First, update the category ENUM to include new categories
ALTER TABLE site_settings 
MODIFY COLUMN category ENUM('security', 'business', 'operational', 'payment', 'delivery', 'identity', 'branding', 'content', 'email', 'insights', 'availability') NOT NULL COMMENT 'Setting category for organization';

-- Insert branding and identity settings from current super_settings.json
INSERT INTO site_settings (setting_key, setting_value, value_type, category, description, is_public) VALUES
-- Identity settings
('siteName', 'My Store', 'string', 'identity', 'Site name displayed in browser tab and emails', TRUE),
('siteEmail', 'hello@example.com', 'string', 'identity', 'Primary contact email for the site', TRUE),
('phone1', '', 'string', 'identity', 'Primary phone number', TRUE),
('phone2', '', 'string', 'identity', 'Secondary phone number', TRUE),
('whatsapp', '', 'string', 'identity', 'WhatsApp number for customer support', TRUE),
('siteTagline', 'Shop online', 'string', 'identity', 'Site tagline shown after name in browser tab', TRUE),
('metaDescription', 'Shop quality products online with secure checkout and support.', 'string', 'identity', 'SEO meta description for search engines', TRUE),
('storeAddress', '', 'string', 'identity', 'Physical store address', TRUE),
('businessHours', 'Mon–Fri, 9am–5pm', 'string', 'identity', 'Business operating hours', TRUE),

-- Social media
('socialInstagram', '', 'string', 'identity', 'Instagram profile URL', TRUE),
('socialTwitter', '', 'string', 'identity', 'Twitter/X profile URL', TRUE),
('socialFacebook', '', 'string', 'identity', 'Facebook page URL', TRUE),
('socialTikTok', '', 'string', 'identity', 'TikTok profile URL', TRUE),
('socialYoutube', '', 'string', 'identity', 'YouTube channel URL', TRUE),

-- Branding assets
('siteLogoUrl', '', 'string', 'branding', 'URL to site logo image', TRUE),
('faviconUrl', '', 'string', 'branding', 'URL to favicon image', TRUE),

-- Branding colors
('primaryColor', '#3b82f6', 'string', 'branding', 'Primary brand color for buttons and links', TRUE),
('accentColor', '#f59e0b', 'string', 'branding', 'Secondary accent color for badges and highlights', TRUE),
('headerBg', '#0f172a', 'string', 'branding', 'Header background color', TRUE),
('fontFamily', 'Inter', 'string', 'branding', 'Primary font family for the site', TRUE),
('selectedTheme', 'iconic_blue', 'string', 'branding', 'Currently selected theme preset', FALSE),

-- Hover colors
('buttonPrimaryHover', '#2563eb', 'string', 'branding', 'Primary button hover color', TRUE),
('buttonSecondaryHover', '#475569', 'string', 'branding', 'Secondary button hover color', TRUE),
('buttonAccentHover', '#d97706', 'string', 'branding', 'Accent button hover color', TRUE),
('linkHover', '#60a5fa', 'string', 'branding', 'Link hover color', TRUE),
('cardHover', '#1e293b', 'string', 'branding', 'Product card hover background color', TRUE),

-- Hero banner content
('heroBannerTagline', '', 'string', 'content', 'Hero section main headline', TRUE),
('heroBannerSubtext', '', 'string', 'content', 'Hero section sub-headline', TRUE),
('heroCTAText', 'Shop Now', 'string', 'content', 'Hero call-to-action button text', TRUE),
('heroCTAUrl', '/products', 'string', 'content', 'Hero call-to-action button URL', TRUE),

-- Email provider settings
('emailProvider', 'smtp', 'string', 'email', 'Email service provider (smtp, mailgun, sendgrid)', FALSE),
('emailProviderSmtpEnabled', 'true', 'boolean', 'email', 'Enable SMTP email provider', FALSE),
('emailProviderMailgunEnabled', 'false', 'boolean', 'email', 'Enable Mailgun email provider', FALSE),
('emailProviderSendgridEnabled', 'false', 'boolean', 'email', 'Enable SendGrid email provider', FALSE),

-- Availability
('maintenanceMode', 'false', 'boolean', 'availability', 'Maintenance mode - closes storefront to customers', TRUE)

ON DUPLICATE KEY UPDATE 
    setting_value = VALUES(setting_value),
    value_type = VALUES(value_type),
    category = VALUES(category),
    updated_at = CURRENT_TIMESTAMP;
