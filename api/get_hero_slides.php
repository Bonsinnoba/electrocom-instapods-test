<?php
// api/get_hero_slides.php
// Dedicated, public, unauthenticated endpoint for the storefront hero
// slider — decoupled entirely from the shared homepage_boot bundle so a
// slow/failing fetch of flash-sale settings, partners, or site settings can
// never hold the slider hostage, and vice versa.

require_once 'cors_middleware.php';
require_once 'db.php';
require_once __DIR__ . '/cache.php';

header('Content-Type: application/json');

try {
    // Self-heal (mirrors admin_slider.php's schema) in case this endpoint
    // is ever hit before the admin panel has provisioned the table.
    $pdo->exec("CREATE TABLE IF NOT EXISTS slider_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        image_url LONGTEXT NOT NULL,
        title VARCHAR(255),
        subtitle VARCHAR(255),
        button_text VARCHAR(100),
        button_link VARCHAR(255),
        text_position VARCHAR(20) DEFAULT 'left',
        content_blocks LONGTEXT,
        display_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    $cacheKey = 'active_hero_slides';
    $cacheGroup = 'homepage';

    $cached = eh_cache_get($cacheKey, $cacheGroup);
    if ($cached !== false) {
        echo json_encode(['success' => true, 'data' => $cached]);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT id, image_url, title, subtitle, button_text, button_link, text_position, content_blocks, display_order
        FROM slider_images
        WHERE is_active = TRUE
        ORDER BY display_order ASC, created_at ASC
    ");
    $stmt->execute();
    $slides = $stmt->fetchAll(PDO::FETCH_ASSOC);

    eh_cache_set($cacheKey, $slides, $cacheGroup, 120); // 2 minutes

    echo json_encode(['success' => true, 'data' => $slides]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to load slides', 'data' => []]);
}
