<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'db.php';

try {
    // Get total unique visitors
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM site_analytics");
    $total_visitors = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Get total registered visitors (users with accounts)
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM site_analytics WHERE is_registered = 1");
    $total_registered = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Get total registered users from users table
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM users");
    $total_users = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Get visitors in last 30 days
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM site_analytics WHERE last_visit >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
    $visitors_last_30_days = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Get registered visitors in last 30 days
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM site_analytics WHERE is_registered = 1 AND last_visit >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
    $registered_last_30_days = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

    echo json_encode([
        'success' => true,
        'data' => [
            'total_unique_visitors' => (int)$total_visitors,
            'total_registered_visitors' => (int)$total_registered,
            'total_users' => (int)$total_users,
            'visitors_last_30_days' => (int)$visitors_last_30_days,
            'registered_last_30_days' => (int)$registered_last_30_days
        ]
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Failed to get visitor statistics: ' . $e->getMessage()
    ]);
}
