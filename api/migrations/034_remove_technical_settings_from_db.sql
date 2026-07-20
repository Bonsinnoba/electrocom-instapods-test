-- Remove technical settings that should be in code or .env
-- Email provider settings are now in .env only
-- Hover colors are now calculated from theme presets in code
-- Identity settings are now in .env only
-- Asset settings are now in .env only

-- Remove identity settings
DELETE FROM site_settings WHERE setting_key IN (
    'siteName',
    'siteEmail',
    'phone1',
    'phone2',
    'whatsapp'
);

-- Remove asset settings
DELETE FROM site_settings WHERE setting_key IN (
    'siteLogoUrl',
    'faviconUrl'
);

-- Remove email provider settings
DELETE FROM site_settings WHERE setting_key IN (
    'emailProvider',
    'emailProviderSmtpEnabled',
    'emailProviderMailgunEnabled',
    'emailProviderSendgridEnabled'
);

-- Remove hover color settings
DELETE FROM site_settings WHERE setting_key IN (
    'buttonPrimaryHover',
    'buttonSecondaryHover',
    'buttonAccentHover',
    'linkHover',
    'cardHover'
);
