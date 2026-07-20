<?php
/**
 * Inspect and retry failed notification_queue rows (super / admin).
 */
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

try {
    requireRole(['super', 'store_manager'], $pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $status = $_GET['status'] ?? 'failed';
    if (!in_array($status, ['failed', 'pending', 'sent'], true)) {
        $status = 'failed';
    }
    $limit = min(500, max(1, (int)($_GET['limit'] ?? 100)));
    try {
        $stmt = $pdo->prepare("
            SELECT id, type, recipient, subject, status, attempts, last_error, created_at, scheduled_at, processed_at, payload
            FROM notification_queue
            WHERE status = ?
            ORDER BY id DESC
            LIMIT " . (int)$limit . "
        ");
        $stmt->execute([$status]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'data' => $rows]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Query failed']);
    }
    exit;
}

if ($method === 'POST') {
    $raw = trim(file_get_contents('php://input'));
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
        exit;
    }
    $action = $decoded['action'] ?? '';
    try {
        if ($action === 'retry_failed') {
            $upd = $pdo->exec("
                UPDATE notification_queue
                SET status = 'pending', attempts = 0, last_error = NULL, scheduled_at = NOW()
                WHERE status = 'failed'
            ");
            echo json_encode(['success' => true, 'retried_rows' => (int)$upd]);
            exit;
        }
        if ($action === 'retry_ids') {
            $ids = $decoded['ids'] ?? [];
            if (!is_array($ids) || empty($ids)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'ids array required']);
                exit;
            }
            $ids = array_values(array_unique(array_map('intval', $ids)));
            $ids = array_filter($ids, function ($id) {
                return $id > 0;
            });
            if (empty($ids)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'No valid ids']);
                exit;
            }
            $ph = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $pdo->prepare("
                UPDATE notification_queue
                SET status = 'pending', attempts = 0, last_error = NULL, scheduled_at = NOW()
                WHERE id IN ($ph) AND status IN ('failed','pending')
            ");
            $stmt->execute($ids);
            echo json_encode(['success' => true, 'retried_rows' => $stmt->rowCount()]);
            exit;
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Update failed']);
        exit;
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Unknown action']);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
