<?php
/**
 * Single source for super_settings.json defaults + merge helpers (brand / site identity).
 * Critical settings are now stored in database for security and validation.
 */

require_once __DIR__ . '/cache.php';

if (!function_exists('eh_super_settings_path')) {
    function eh_super_settings_path(): string
    {
        return __DIR__ . '/data/super_settings.json';
    }
}

if (!function_exists('eh_critical_db_settings_keys')) {
    /** Settings that should be stored in database for security and validation */
    function eh_critical_db_settings_keys(): array
    {
        return [
            // Identity (branding)
            'siteName', 'siteEmail', 'phone1', 'phone2', 'whatsapp', 'siteTagline', 'metaDescription',
            // Assets (branding)
            'siteLogoUrl', 'faviconUrl',
            // Location (branding)
            'storeAddress', 'businessHours',
            // Social (branding)
            'socialInstagram', 'socialTwitter', 'socialFacebook', 'socialTikTok', 'socialYoutube',
            // Branding colors
            'primaryColor', 'accentColor', 'headerBg', 'fontFamily', 'selectedTheme',
            // Hover colors
            'buttonPrimaryHover', 'buttonSecondaryHover', 'buttonAccentHover', 'linkHover', 'cardHover',
            // Hero banner
            'heroBannerTagline', 'heroBannerSubtext', 'heroCTAText', 'heroCTAUrl',
            // Flash sale banner
            'flashSaleBannerEnabled',
            // Security settings
            'maxLoginAttempts', 'sessionTimeout', 'twoFactorAdmin', 'lockoutDuration',
            'passwordMinLength', 'requireEmailVerification', 'requireNumberInPassword',
            'apiRateLimit', 'emailNotify', 'securityAlerts', 'debugMode',
            // Business settings
            'vatRate', 'allowRegistration', 'allowCardPayment', 'lowStockThreshold',
            'lowStockAlertEmail', 'integrityDiscountThreshold', 'integrityDiscountPct',
            // Operational settings
            'backupFrequency', 'defaultItemsPerPage', 'homepageSectionTitle',
            'homepageFeaturedCategory', 'orderReceiptFooterNote',
            // Delivery settings
            'allowDoorToDoorDelivery', 'doorToDoorThreshold',
            // Insights settings
            'insightsShipWarnHours', 'insightsShipCriticalHours', 'insightsLowStockWarnCount',
            'insightsLowStockCriticalCount', 'insightsOnlineRevenueMinPct', 'insightsRepeatOrderMin',
            'insightsWeightShip', 'insightsWeightStock', 'insightsWeightOnline', 'insightsWeightRepeat',
            // Email providers
            'emailProvider', 'emailProviderSmtpEnabled', 'emailProviderMailgunEnabled', 'emailProviderSendgridEnabled',
            // Availability
            'maintenanceMode',
        ];
    }
}

if (!function_exists('eh_always_load_settings_keys')) {
    /** Settings that are accessed on every page load (storefront) - cached with longer TTL */
    function eh_always_load_settings_keys(): array
    {
        return [
            // Branding (every page)
            'siteName', 'siteLogoUrl', 'faviconUrl', 'primaryColor', 'accentColor', 'headerBg', 'fontFamily',
            // Contact (every page)
            'siteEmail', 'phone1', 'phone2', 'whatsapp', 'storeAddress', 'businessHours',
            // Social (every page)
            'socialInstagram', 'socialTwitter', 'socialFacebook', 'socialTikTok', 'socialYoutube',
            // Hero (homepage)
            'heroBannerTagline', 'heroBannerSubtext', 'heroCTAText', 'heroCTAUrl',
            // Flash sale banner (homepage)
            'flashSaleBannerEnabled',
            // SEO (every page)
            'siteTagline', 'metaDescription',
            // Availability (every page)
            'maintenanceMode', 'allowRegistration', 'allowCardPayment', 'allowDoorToDoorDelivery', 'doorToDoorThreshold',
            // Email providers (checkout)
            'emailProvider', 'emailProviderSmtpEnabled', 'emailProviderMailgunEnabled', 'emailProviderSendgridEnabled',
            // Storefront operational (every page)
            'defaultItemsPerPage', 'homepageSectionTitle', 'homepageFeaturedCategory', 'vatRate', 'orderReceiptFooterNote',
            // Loyalty (storefront)
            'integrityDiscountThreshold', 'integrityDiscountPct'
        ];
    }
}

if (!function_exists('eh_occasional_settings_keys')) {
    /** Settings accessed occasionally (admin panel, specific operations) - cached with shorter TTL */
    function eh_occasional_settings_keys(): array
    {
        return [
            // Security (admin panel, login)
            'maxLoginAttempts', 'sessionTimeout', 'twoFactorAdmin', 'lockoutDuration',
            'passwordMinLength', 'requireEmailVerification', 'requireNumberInPassword',
            'apiRateLimit', 'emailNotify', 'securityAlerts', 'debugMode',
            // Business (checkout, admin)
            'vatRate', 'lowStockThreshold', 'lowStockAlertEmail', 'integrityDiscountThreshold', 'integrityDiscountPct',
            // Operational (admin panel)
            'backupFrequency', 'defaultItemsPerPage', 'homepageSectionTitle',
            'homepageFeaturedCategory', 'orderReceiptFooterNote',
            // Insights (admin panel)
            'insightsShipWarnHours', 'insightsShipCriticalHours', 'insightsLowStockWarnCount',
            'insightsLowStockCriticalCount', 'insightsOnlineRevenueMinPct', 'insightsRepeatOrderMin',
            'insightsWeightShip', 'insightsWeightStock', 'insightsWeightOnline', 'insightsWeightRepeat'
        ];
    }
}

if (!function_exists('eh_get_db_settings')) {
    /** Fetch critical settings from database with caching */
    function eh_get_db_settings(bool $forceRefresh = false): ?array
    {
        $cacheKey = 'db_settings';
        $cacheGroup = 'settings';

        // Try to get from cache first
        if (!$forceRefresh) {
            $cached = eh_cache_get($cacheKey, $cacheGroup);
            if ($cached !== false) {
                return $cached;
            }
        }

        try {
            require_once __DIR__ . '/db.php';
            global $pdo;

            $stmt = $pdo->prepare("SELECT setting_key, setting_value, value_type FROM site_settings");
            $stmt->execute();
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $dbSettings = [];
            foreach ($results as $row) {
                $value = $row['setting_value'];
                // Convert based on type
                switch ($row['value_type']) {
                    case 'integer':
                        $value = (int) $value;
                        break;
                    case 'float':
                        $value = (float) $value;
                        break;
                    case 'boolean':
                        $value = filter_var($value, FILTER_VALIDATE_BOOLEAN);
                        break;
                    case 'json':
                        $value = json_decode($value, true) ?? $value;
                        break;
                }
                $dbSettings[$row['setting_key']] = $value;
            }

            // Cache for 5 minutes (300 seconds)
            eh_cache_set($cacheKey, $dbSettings, $cacheGroup, 300);

            return $dbSettings;
        } catch (Exception $e) {
            // Return null on actual DB failure (table doesn't exist, connection error, etc.)
            // This allows merge logic to distinguish between failure and no data
            return null;
        }
    }
}

if (!function_exists('eh_get_always_load_settings')) {
    /**
     * Get settings that are accessed on every page load (WordPress alloptions style)
     * These are cached with longer TTL (30 minutes) since they're used frequently
     */
    function eh_get_always_load_settings(bool $forceRefresh = false): array
    {
        $cacheKey = 'always_load_settings';
        $cacheGroup = 'settings_always';

        // Try to get from cache first
        if (!$forceRefresh) {
            $cached = eh_cache_get($cacheKey, $cacheGroup);
            if ($cached !== false) {
                return $cached;
            }
        }

        // Get all merged settings first
        $allSettings = eh_merged_super_settings($forceRefresh);
        $alwaysLoadKeys = eh_always_load_settings_keys();

        // Filter to only always-load settings
        $alwaysLoadSettings = array_intersect_key($allSettings, array_flip($alwaysLoadKeys));

        // Cache for 30 minutes (1800 seconds) - longer since these are used frequently
        eh_cache_set($cacheKey, $alwaysLoadSettings, $cacheGroup, 1800);

        return $alwaysLoadSettings;
    }
}

if (!function_exists('eh_get_occasional_settings')) {
    /**
     * Get settings that are accessed occasionally (admin panel, specific operations)
     * These are cached with shorter TTL (5 minutes) since they change more often
     */
    function eh_get_occasional_settings(bool $forceRefresh = false): array
    {
        $cacheKey = 'occasional_settings';
        $cacheGroup = 'settings_occasional';

        // Try to get from cache first
        if (!$forceRefresh) {
            $cached = eh_cache_get($cacheKey, $cacheGroup);
            if ($cached !== false) {
                return $cached;
            }
        }

        // Get all merged settings first
        $allSettings = eh_merged_super_settings($forceRefresh);
        $occasionalKeys = eh_occasional_settings_keys();

        // Filter to only occasional settings
        $occasionalSettings = array_intersect_key($allSettings, array_flip($occasionalKeys));

        // Cache for 5 minutes (300 seconds) - shorter since they're used less frequently
        eh_cache_set($cacheKey, $occasionalSettings, $cacheGroup, 300);

        return $occasionalSettings;
    }
}

if (!function_exists('eh_theme_presets')) {
    /**
     * Pre-defined theme presets for the super admin to choose from
     */
    function eh_theme_presets(): array
    {
        return [
            'iconic_blue' => [
                'name' => 'Iconic Blue',
                'primaryColor' => '#3b82f6',
                'accentColor' => '#f59e0b',
                'headerBg' => '#0f172a',
                'buttonPrimaryHover' => '#2563eb',
                'buttonSecondaryHover' => '#475569',
                'buttonAccentHover' => '#d97706',
                'linkHover' => '#60a5fa',
                'cardHover' => '#1e293b',
            ],
            'emerald_green' => [
                'name' => 'Emerald Green',
                'primaryColor' => '#10b981',
                'accentColor' => '#059669',
                'headerBg' => '#064e3b',
                'buttonPrimaryHover' => '#059669',
                'buttonSecondaryHover' => '#475569',
                'buttonAccentHover' => '#047857',
                'linkHover' => '#34d399',
                'cardHover' => '#064e3b',
            ],
            'royal_purple' => [
                'name' => 'Royal Purple',
                'primaryColor' => '#8b5cf6',
                'accentColor' => '#7c3aed',
                'headerBg' => '#4c1d95',
                'buttonPrimaryHover' => '#7c3aed',
                'buttonSecondaryHover' => '#475569',
                'buttonAccentHover' => '#6d28d9',
                'linkHover' => '#a78bfa',
                'cardHover' => '#4c1d95',
            ],
        ];
    }
}

if (!function_exists('eh_storefront_public_setting_keys')) {
    /** Keys safe to expose to the storefront via get_site_settings.php */
    function eh_storefront_public_setting_keys(): array
    {
        return [
            'siteName', 'siteEmail', 'phone1', 'phone2', 'whatsapp', 'maintenanceMode',
            'siteLogoUrl', 'faviconUrl', 'storeAddress', 'businessHours',
            'socialInstagram', 'socialTwitter', 'socialFacebook', 'socialTikTok', 'socialYoutube',
            'primaryColor', 'accentColor', 'headerBg', 'fontFamily',
            'buttonPrimaryHover', 'buttonSecondaryHover', 'buttonAccentHover', 'linkHover', 'cardHover',
            'heroBannerTagline', 'heroBannerSubtext', 'heroCTAText', 'heroCTAUrl',
            'flashSaleBannerEnabled',
            'siteTagline', 'metaDescription',
            'defaultItemsPerPage', 'homepageSectionTitle', 'homepageFeaturedCategory',
            'vatRate', 'allowRegistration', 'allowDoorToDoorDelivery', 'doorToDoorThreshold', 'allowCardPayment', 'orderReceiptFooterNote',
            'integrityDiscountThreshold', 'integrityDiscountPct',
        ];
    }
}

if (!function_exists('eh_merged_super_settings')) {
    /** Merge all settings with caching - all settings stored in database */
    function eh_merged_super_settings(bool $forceRefresh = false): array
    {
        $cacheKey = 'merged_settings';
        $cacheGroup = 'settings';

        // Try to get from cache first
        if (!$forceRefresh) {
            $cached = eh_cache_get($cacheKey, $cacheGroup);
            if ($cached !== false && $cached !== null) {
                return $cached;
            }
        }

        $dbStored = eh_get_db_settings($forceRefresh);

        // Only use database settings - no defaults
        if ($dbStored === null || empty($dbStored)) {
            // Database failed or has no data - return empty array
            $merged = [];
        } else {
            // Database succeeded - use only DB values
            $merged = $dbStored;
        }

        // Cache for 10 minutes (600 seconds)
        eh_cache_set($cacheKey, $merged, $cacheGroup, 600);

        return $merged;
    }
}

if (!function_exists('eh_brand_site_name')) {
    function eh_brand_site_name(): string
    {
        $m = eh_merged_super_settings();
        $n = trim((string) ($m['siteName'] ?? ''));

        return $n !== '' ? $n : 'My Store';
    }
}

if (!function_exists('eh_brand_site_email')) {
    function eh_brand_site_email(): string
    {
        $m = eh_merged_super_settings();
        $e = trim((string) ($m['siteEmail'] ?? ''));

        return $e !== '' ? $e : 'hello@example.com';
    }
}

if (!function_exists('eh_brand_invoice_block')) {
    /** @return array{name:string,email:string,phone_line:string,address:string,footer_note:string} */
    function eh_brand_invoice_block(): array
    {
        $m = eh_merged_super_settings();
        $p1 = trim((string) ($m['phone1'] ?? ''));
        $p2 = trim((string) ($m['phone2'] ?? ''));
        $phones = array_filter([$p1, $p2]);
        $phoneLine = count($phones) ? implode(' / ', $phones) : '';
        $footer = trim((string) ($m['orderReceiptFooterNote'] ?? ''));

        return [
            'name'        => eh_brand_site_name(),
            'email'       => eh_brand_site_email(),
            'phone_line'  => $phoneLine,
            'address'     => trim((string) ($m['storeAddress'] ?? '')),
            'footer_note' => $footer,
        ];
    }
}
