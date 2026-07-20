<?php
// backend/get_slider.php
require_once 'cors_middleware.php';
require_once 'db.php';

header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate'); // HTTP 1.1.
header('Pragma: no-cache'); // HTTP 1.0.
header('Expires: 0'); // Proxies.

try {
    // Self-healing: Ensure table exists
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

    // Ensure columns exist (for older installations)
    $columns = $pdo->query("DESCRIBE slider_images")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('text_position', $columns)) {
        $pdo->exec("ALTER TABLE slider_images ADD COLUMN text_position VARCHAR(20) DEFAULT 'left' AFTER button_link");
    }
    if (!in_array('content_blocks', $columns)) {
        $pdo->exec("ALTER TABLE slider_images ADD COLUMN content_blocks LONGTEXT AFTER text_position");
    }

    // Ensure image_url can handle large base64 strings
    $pdo->exec("ALTER TABLE slider_images MODIFY COLUMN image_url LONGTEXT NOT NULL");

    $stmt = $pdo->prepare("SELECT * FROM slider_images WHERE is_active = TRUE ORDER BY display_order ASC, created_at ASC");
    $stmt->execute();
    $slides = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $slides]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to fetch slides']);
}
