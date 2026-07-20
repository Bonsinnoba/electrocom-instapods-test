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
            // SEO (branding)
            'siteTagline', 'metaDescription',
            // Location (branding)
            'storeAddress', 'businessHours',
            // Social (branding)
            'socialInstagram', 'socialTwitter', 'socialFacebook', 'socialTikTok', 'socialYoutube',
            // Branding colors
            'primaryColor', 'accentColor', 'headerBg', 'fontFamily', 'selectedTheme',
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
            'primaryColor', 'accentColor', 'headerBg', 'fontFamily',
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
    /** Fetch critical settings from database with file + in-memory caching */
    function eh_get_db_settings(bool $forceRefresh = false): ?array
    {
        // In-memory cache: avoids file I/O on repeated calls within the same request
        static $memCache = null;
        if (!$forceRefresh && $memCache !== null) {
            return $memCache;
        }

        $cacheKey = 'db_settings';
        $cacheGroup = 'settings';

        // Try file/Redis cache before hitting the DB
        if (!$forceRefresh) {
            $cached = eh_cache_get($cacheKey, $cacheGroup);
            if ($cached !== false) {
                $memCache = $cached;
                return $memCache;
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

            // Persist to file/Redis cache for 5 minutes
            eh_cache_set($cacheKey, $dbSettings, $cacheGroup, 300);

            $memCache = $dbSettings;
            return $memCache;
        } catch (Exception $e) {
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
            ],
            'emerald_green' => [
                'name' => 'Emerald Green',
                'primaryColor' => '#10b981',
                'accentColor' => '#059669',
                'headerBg' => '#064e3b',
            ],
            'royal_purple' => [
                'name' => 'Royal Purple',
                'primaryColor' => '#8b5cf6',
                'accentColor' => '#7c3aed',
                'headerBg' => '#4c1d95',
            ],
        ];
    }
}

if (!function_exists('eh_calculate_hover_colors')) {
    /**
     * Calculate hover colors from base theme colors
     * Uses color manipulation to create darker/lighter variants
     */
    function eh_calculate_hover_colors(string $primaryColor, string $accentColor, string $headerBg): array
    {
        // Helper to darken a hex color
        $darken = function(string $hex, int $percent): string {
            $hex = ltrim($hex, '#');
            $r = hexdec(substr($hex, 0, 2));
            $g = hexdec(substr($hex, 2, 2));
            $b = hexdec(substr($hex, 4, 2));
            
            $r = max(0, (int)($r * (100 - $percent) / 100));
            $g = max(0, (int)($g * (100 - $percent) / 100));
            $b = max(0, (int)($b * (100 - $percent) / 100));
            
            return sprintf('#%02x%02x%02x', $r, $g, $b);
        };
        
        // Helper to lighten a hex color
        $lighten = function(string $hex, int $percent): string {
            $hex = ltrim($hex, '#');
            $r = hexdec(substr($hex, 0, 2));
            $g = hexdec(substr($hex, 2, 2));
            $b = hexdec(substr($hex, 4, 2));
            
            $r = min(255, (int)($r + (255 - $r) * $percent / 100));
            $g = min(255, (int)($g + (255 - $g) * $percent / 100));
            $b = min(255, (int)($b + (255 - $b) * $percent / 100));
            
            return sprintf('#%02x%02x%02x', $r, $g, $b);
        };
        
        return [
            'buttonPrimaryHover' => $darken($primaryColor, 15),
            'buttonSecondaryHover' => '#475569', // Fixed slate color
            'buttonAccentHover' => $darken($accentColor, 15),
            'linkHover' => $lighten($primaryColor, 20),
            'cardHover' => $headerBg,
        ];
    }
}

if (!function_exists('eh_storefront_public_setting_keys')) {
    /** Keys safe to expose to the storefront via get_site_settings.php */
    function eh_storefront_public_setting_keys(): array
    {
        return [
            'siteName', 'siteEmail', 'phone1', 'phone2', 'whatsapp', 'maintenanceMode',
            'siteLogoUrl', 'faviconUrl',
            'socialInstagram', 'socialTwitter', 'socialFacebook', 'socialTikTok', 'socialYoutube',
            'primaryColor', 'accentColor', 'headerBg', 'fontFamily',
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
    /** Merge all settings with in-memory + file caching */
    function eh_merged_super_settings(bool $forceRefresh = false): array
    {
        // In-memory cache: free after the first call within the same request
        static $memCache = null;
        if (!$forceRefresh && $memCache !== null) {
            return $memCache;
        }

        $cacheKey = 'merged_settings';
        $cacheGroup = 'settings';

        if (!$forceRefresh) {
            $cached = eh_cache_get($cacheKey, $cacheGroup);
            if ($cached !== false && $cached !== null) {
                $memCache = $cached;
                return $memCache;
            }
        }

        $dbStored = eh_get_db_settings($forceRefresh);

        $merged = ($dbStored === null || empty($dbStored)) ? [] : $dbStored;

        // Overlay .env-backed settings so they always win over DB values
        // (avoids DB storing duplicates of infrastructure config)
        $envOverrides = array_filter([
            'debugMode'   => ($v = getenv('APP_DEBUG'))   !== false ? filter_var($v, FILTER_VALIDATE_BOOLEAN) : null,
            'apiRateLimit'=> ($v = getenv('API_RATE_LIMIT')) !== false ? (int)$v : null,
            // Identity from .env
            'siteName'    => ($v = getenv('SITE_NAME'))    !== false ? $v : null,
            'siteEmail'   => ($v = getenv('SITE_EMAIL'))   !== false ? $v : null,
            'phone1'      => ($v = getenv('PHONE1'))      !== false ? $v : null,
            'phone2'      => ($v = getenv('PHONE2'))      !== false ? $v : null,
            'whatsapp'    => ($v = getenv('WHATSAPP'))    !== false ? $v : null,
            // Assets from .env
            'siteLogoUrl' => ($v = getenv('SITE_LOGO_URL')) !== false ? $v : null,
            'faviconUrl'  => ($v = getenv('FAVICON_URL'))   !== false ? $v : null,
        ], fn($v) => $v !== null);
        $merged = array_merge($merged, $envOverrides);

        // Persist to file/Redis cache for 10 minutes
        eh_cache_set($cacheKey, $merged, $cacheGroup, 600);

        $memCache = $merged;
        return $memCache;
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
