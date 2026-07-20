<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once 'db.php';

try {
    // Create site_analytics_history table for daily statistics
    $sql = "CREATE TABLE IF NOT EXISTS site_analytics_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        unique_visitors INT DEFAULT 0,
        registered_visitors INT DEFAULT 0,
        total_visits INT DEFAULT 0,
        new_visitors INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_date (date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $pdo->exec($sql);

    echo json_encode([
        'success' => true,
        'message' => 'Site analytics history table created successfully'
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Failed to create site analytics history table: ' . $e->getMessage()
    ]);
}
