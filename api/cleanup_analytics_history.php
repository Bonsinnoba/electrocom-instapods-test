<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'db.php';
require 'security.php';

try {
    $userId = requireRole('super', $pdo);

    // Delete analytics history older than 1 year
    $stmt = $pdo->prepare("
        DELETE FROM site_analytics_history
        WHERE date < DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
    ");
    $stmt->execute();
    $deletedRows = $stmt->rowCount();

    echo json_encode([
        'success' => true,
        'message' => "Cleaned up {$deletedRows} old analytics records",
        'deleted_rows' => $deletedRows
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Failed to cleanup analytics history: ' . $e->getMessage()
    ]);
}
