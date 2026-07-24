<?php
require_once 'db.php';
require_once 'security.php';
require_once __DIR__ . '/cache.php';

header('Content-Type: application/json');

// Self-heal schema for flash sale banner settings
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

// Initialize default settings if not exists
$stmt = $pdo->query("SELECT COUNT(*) FROM flash_sale_banner_settings");
if ($stmt->fetchColumn() == 0) {
    $pdo->exec("INSERT INTO flash_sale_banner_settings (id) VALUES (1)");
}

$method = $_SERVER['REQUEST_METHOD'];
$isAdmin = isset($_GET['admin']) && $_GET['admin'] === 'true';

// Public GET endpoint (no auth required)
if ($method === 'GET' && !$isAdmin) {
    try {
        $stmt = $pdo->query("SELECT * FROM flash_sale_banner_settings WHERE id = 1");
        $settings = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$settings) {
            sendResponse(false, 'Settings not found', null, 404);
        }

        sendResponse(true, 'Settings fetched successfully', $settings);
    } catch (PDOException $e) {
        sendDatabaseError($e, 'Unable to fetch settings.');
    }
}

// Admin endpoints (auth required)
if ($isAdmin) {
    try {
        $userId = authenticate();
        requireRole(['super', 'store_manager', 'marketing'], $pdo);
    } catch (Exception $e) {
        sendResponse(false, 'Unauthorized', null, 401);
    }
}

if ($method === 'GET' && $isAdmin) {
    // Get current settings (admin)
    try {
        $stmt = $pdo->query("SELECT * FROM flash_sale_banner_settings WHERE id = 1");
        $settings = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$settings) {
            sendResponse(false, 'Settings not found', null, 404);
        }

        sendResponse(true, 'Settings fetched successfully', $settings);
    } catch (PDOException $e) {
        sendDatabaseError($e, 'Unable to fetch settings.');
    }
} elseif ($method === 'POST') {
    // Update settings
    $data = json_decode(file_get_contents('php://input'), true);

    $allowedFields = [
        'is_enabled',
        'new_arrivals_enabled', 'new_arrivals_days', 'new_arrivals_title', 'new_arrivals_subtitle', 'new_arrivals_cta',
        'low_stock_enabled', 'low_stock_threshold', 'low_stock_title', 'low_stock_subtitle', 'low_stock_cta',
        'popular_enabled', 'popular_title', 'popular_subtitle', 'popular_cta',
        'promotion_enabled', 'promotion_title', 'promotion_subtitle', 'promotion_cta',
        'flash_sale_title', 'flash_sale_subtitle', 'flash_sale_cta'
    ];

    $updateFields = [];
    $updateValues = [];

    foreach ($allowedFields as $field) {
        if (isset($data[$field])) {
            $updateFields[] = "$field = ?";
            $updateValues[] = $data[$field];
        }
    }

    if (empty($updateFields)) {
        sendResponse(false, 'No valid fields to update', null, 400);
    }

    $updateValues[] = 1; // id

    try {
        $sql = "UPDATE flash_sale_banner_settings SET " . implode(', ', $updateFields) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($updateValues);

        eh_cache_delete('homepage_boot', 'homepage');
        sendResponse(true, 'Settings updated successfully');
    } catch (PDOException $e) {
        sendDatabaseError($e, 'Unable to update settings.');
    }
} else {
    sendResponse(false, 'Method not allowed', null, 405);
}
