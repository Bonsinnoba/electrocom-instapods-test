<?php
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

try {
    $stmt = $pdo->query("SELECT id, name, address, city, fee FROM pickup_locations WHERE is_active = 1 ORDER BY name ASC");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'data' => $rows]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to fetch pickup locations']);
}
