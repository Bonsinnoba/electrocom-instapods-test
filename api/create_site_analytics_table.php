<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once 'db.php';

try {
    // Create site_analytics table
    $sql = "CREATE TABLE IF NOT EXISTS site_analytics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        visitor_id VARCHAR(255) NOT NULL UNIQUE,
        first_visit DATETIME NOT NULL,
        last_visit DATETIME NOT NULL,
        visit_count INT DEFAULT 1,
        is_registered TINYINT(1) DEFAULT 0,
        user_id INT NULL,
        INDEX idx_visitor_id (visitor_id),
        INDEX idx_last_visit (last_visit),
        INDEX idx_is_registered (is_registered)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $pdo->exec($sql);

    echo json_encode([
        'success' => true,
        'message' => 'Site analytics table created successfully'
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Failed to create site analytics table: ' . $e->getMessage()
    ]);
}
