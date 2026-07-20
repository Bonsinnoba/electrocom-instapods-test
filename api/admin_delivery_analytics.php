<?php
/**
 * Delivery analytics for queued email/SMS (broadcast + transactional when payload tagged).
 * "Delivered" aligns with queue status `sent` (provider-level delivery is not tracked here).
 */
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

try {
    requireRole(['super', 'marketing', 'store_manager'], $pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$days = min(90, max(1, (int)($_GET['days'] ?? 30)));

try {
    $byChannel = [];
    $stmt = $pdo->prepare("
        SELECT type, status, COUNT(*) AS cnt
        FROM notification_queue
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY type, status
    ");
    $stmt->execute([$days]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $type = $row['type'];
        $status = $row['status'];
        if (!isset($byChannel[$type])) {
            $byChannel[$type] = ['sent' => 0, 'failed' => 0, 'pending' => 0, 'delivered' => 0];
        }
        $c = (int)$row['cnt'];
        $byChannel[$type][$status] = ($byChannel[$type][$status] ?? 0) + $c;
        if ($status === 'sent') {
            $byChannel[$type]['delivered'] += $c;
        }
    }

    $byRoleSegment = [];
    $roleStmt = $pdo->prepare("
        SELECT
            type,
            COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.audience_role')), 'unknown') AS audience_role,
            status,
            COUNT(*) AS cnt
        FROM notification_queue
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY type, audience_role, status
    ");
    $roleStmt->execute([$days]);
    while ($row = $roleStmt->fetch(PDO::FETCH_ASSOC)) {
        $role = $row['audience_role'] ?: 'unknown';
        if (!isset($byRoleSegment[$role])) {
            $byRoleSegment[$role] = [
                'email' => ['sent' => 0, 'failed' => 0, 'pending' => 0, 'delivered' => 0],
                'sms' => ['sent' => 0, 'failed' => 0, 'pending' => 0, 'delivered' => 0],
            ];
        }
        $ch = $row['type'];
        if (!isset($byRoleSegment[$role][$ch])) {
            $byRoleSegment[$role][$ch] = ['sent' => 0, 'failed' => 0, 'pending' => 0, 'delivered' => 0];
        }
        $st = $row['status'];
        $c = (int)$row['cnt'];
        $byRoleSegment[$role][$ch][$st] = ($byRoleSegment[$role][$ch][$st] ?? 0) + $c;
        if ($st === 'sent') {
            $byRoleSegment[$role][$ch]['delivered'] += $c;
        }
    }

    $inAppStmt = $pdo->prepare("
        SELECT COUNT(*) FROM notifications
        WHERE type = 'promo' AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    ");
    $inAppStmt->execute([$days]);
    $inAppBroadcasts = (int)$inAppStmt->fetchColumn();

    echo json_encode([
        'success' => true,
        'days' => $days,
        'data' => [
            'by_channel' => $byChannel,
            'by_role_segment' => $byRoleSegment,
            'in_app_broadcast_rows' => $inAppBroadcasts,
        ],
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Analytics query failed']);
}
