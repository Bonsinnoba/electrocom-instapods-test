<?php
/**
 * get_homepage_boot.php
 * Storefront bootstrap endpoint for homepage-critical data.
 * Returns CSRF token, public site settings, slides, partners, and flash sale banner settings.
 */

require_once __DIR__ . '/cors_middleware.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/cache.php';
require_once __DIR__ . '/brand_settings.php';
require_once __DIR__ . '/security.php';

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

try {
    $cacheKey = 'homepage_boot';
    $cacheGroup = 'homepage';

    $cached = eh_cache_get($cacheKey, $cacheGroup);
    if ($cached !== false) {
        $responseData = $cached;
    } else {
        // Site settings safe for storefront exposure.
        $allSettings = eh_merged_super_settings();
        $siteSettings = array_intersect_key($allSettings, array_flip(eh_storefront_public_setting_keys()));

        $boolKeys = [
            'maintenanceMode', 'allowRegistration', 'allowDoorToDoorDelivery', 'allowCardPayment',
            'flashSaleBannerEnabled'
        ];
        foreach ($boolKeys as $key) {
            if (array_key_exists($key, $siteSettings)) {
                $siteSettings[$key] = filter_var($siteSettings[$key], FILTER_VALIDATE_BOOLEAN);
            }
        }

    $numKeys = [
        'vatRate', 'doorToDoorThreshold', 'defaultItemsPerPage',
        'integrityDiscountThreshold', 'integrityDiscountPct'
    ];
    foreach ($numKeys as $key) {
        if (array_key_exists($key, $siteSettings)) {
            if (is_numeric($siteSettings[$key])) {
                $siteSettings[$key] = strpos((string)$siteSettings[$key], '.') !== false
                    ? (float)$siteSettings[$key]
                    : (int)$siteSettings[$key];
            }
        }
    }

    // Slides
    $pdo->exec("CREATE TABLE IF NOT EXISTS slider_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        image_url LONGTEXT NOT NULL,
        title VARCHAR(255),
        subtitle VARCHAR(255),
        button_text VARCHAR(50),
        button_link VARCHAR(255),
        text_position VARCHAR(20) DEFAULT 'left',
        content_blocks LONGTEXT,
        display_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
    $pdo->exec("ALTER TABLE slider_images MODIFY COLUMN image_url LONGTEXT NOT NULL");
    $slidesStmt = $pdo->prepare("SELECT * FROM slider_images WHERE is_active = TRUE ORDER BY display_order ASC, created_at ASC");
    $slidesStmt->execute();
    $slides = $slidesStmt->fetchAll(PDO::FETCH_ASSOC);

    // Partners
    $pdo->exec("CREATE TABLE IF NOT EXISTS partners (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        logo_url LONGTEXT NOT NULL,
        display_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
    $partnersStmt = $pdo->prepare("SELECT * FROM partners WHERE is_active = TRUE ORDER BY display_order ASC, created_at ASC");
    $partnersStmt->execute();
    $partners = $partnersStmt->fetchAll(PDO::FETCH_ASSOC);

    // Flash sale banner settings
    $pdo->exec("CREATE TABLE IF NOT EXISTS flash_sale_banner_settings (
        id INT PRIMARY KEY,
        is_enabled TINYINT(1) DEFAULT 1,
        new_arrivals_enabled TINYINT(1) DEFAULT 1,
        new_arrivals_days INT DEFAULT 7,
        new_arrivals_title VARCHAR(255) DEFAULT 'Just Arrived',
        new_arrivals_subtitle VARCHAR(255) DEFAULT '{count} new products added this week',
        new_arrivals_cta VARCHAR(100) DEFAULT 'Explore New',
        low_stock_enabled TINYINT(1) DEFAULT 1,
        low_stock_threshold INT DEFAULT 5,
        low_stock_title VARCHAR(255) DEFAULT 'Low Stock Alert',
        low_stock_subtitle VARCHAR(255) DEFAULT '{count} items running low - grab them before they\'re gone',
        low_stock_cta VARCHAR(100) DEFAULT 'Shop Now',
        popular_enabled TINYINT(1) DEFAULT 1,
        popular_title VARCHAR(255) DEFAULT 'Trending Now',
        popular_subtitle VARCHAR(255) DEFAULT 'Most popular items based on customer purchases',
        popular_cta VARCHAR(100) DEFAULT 'View Popular',
        promotion_enabled TINYINT(1) DEFAULT 1,
        promotion_title VARCHAR(255) DEFAULT 'Free Shipping',
        promotion_subtitle VARCHAR(255) DEFAULT 'On orders over GHS 500',
        promotion_cta VARCHAR(100) DEFAULT 'Start Shopping',
        flash_sale_title VARCHAR(255) DEFAULT 'Limited Time Flash Sale',
        flash_sale_subtitle VARCHAR(255) DEFAULT 'Spotlight Deal: {product_name}',
        flash_sale_cta VARCHAR(100) DEFAULT 'Shop Deal',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )");

    $countStmt = $pdo->query("SELECT COUNT(*) FROM flash_sale_banner_settings");
    if ($countStmt->fetchColumn() == 0) {
        $pdo->exec("INSERT INTO flash_sale_banner_settings (id) VALUES (1)");
    }

    $flashSaleStmt = $pdo->prepare("SELECT * FROM flash_sale_banner_settings WHERE id = 1");
    $flashSaleStmt->execute();
    $flashSaleSettings = $flashSaleStmt->fetch(PDO::FETCH_ASSOC);

    $responseData = [
        'site_settings' => $siteSettings,
        'slides' => $slides,
        'partners' => $partners,
        'flash_sale_banner_settings' => $flashSaleSettings ?: null
    ];

    if ($cached === false) {
        eh_cache_set($cacheKey, $responseData, $cacheGroup, 300);
    }

    $responseData['csrf_token'] = generateCSRFToken();
    echo json_encode(['success' => true, 'data' => $responseData]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to load homepage boot payload: ' . $e->getMessage()]);
}
