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

try {
    $data = json_decode(file_get_contents('php://input'), true);

    // Generate or get visitor ID from cookie/localstorage
    $visitor_id = $data['visitor_id'] ?? null;
    $user_id = $data['user_id'] ?? null;
    $is_registered = $user_id ? 1 : 0;

    if (!$visitor_id) {
        echo json_encode([
            'success' => false,
            'message' => 'Visitor ID is required'
        ]);
        exit;
    }

    $now = date('Y-m-d H:i:s');
    $today = date('Y-m-d');

    // Check if visitor exists
    $stmt = $pdo->prepare("SELECT * FROM site_analytics WHERE visitor_id = ?");
    $stmt->execute([$visitor_id]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    $isNewVisitor = false;

    if ($existing) {
        // Update existing visitor
        $stmt = $pdo->prepare("
            UPDATE site_analytics
            SET last_visit = ?,
                visit_count = visit_count + 1,
                is_registered = ?,
                user_id = ?
            WHERE visitor_id = ?
        ");
        $stmt->execute([$now, $is_registered, $user_id, $visitor_id]);
    } else {
        // Insert new visitor
        $stmt = $pdo->prepare("
            INSERT INTO site_analytics (visitor_id, first_visit, last_visit, visit_count, is_registered, user_id)
            VALUES (?, ?, ?, 1, ?, ?)
        ");
        $stmt->execute([$visitor_id, $now, $now, $is_registered, $user_id]);
        $isNewVisitor = true;
    }

    // Update daily statistics for growth analytics using UPSERT
    $stmt = $pdo->prepare("
        INSERT INTO site_analytics_history (date, unique_visitors, registered_visitors, total_visits, new_visitors)
        VALUES (?, ?, ?, 1, ?)
        ON DUPLICATE KEY UPDATE
            unique_visitors = unique_visitors + VALUES(unique_visitors),
            registered_visitors = registered_visitors + VALUES(registered_visitors),
            total_visits = total_visits + 1,
            new_visitors = new_visitors + VALUES(new_visitors)
    ");
    $stmt->execute([$today, $isNewVisitor ? 1 : 0, $is_registered ? 1 : 0, $isNewVisitor ? 1 : 0]);

    echo json_encode([
        'success' => true,
        'message' => 'Visit tracked successfully'
    ]);
} catch (PDOException $e) {
    error_log('[track_visit] Database error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Failed to track visit: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log('[track_visit] General error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Failed to track visit: ' . $e->getMessage()
    ]);
}
