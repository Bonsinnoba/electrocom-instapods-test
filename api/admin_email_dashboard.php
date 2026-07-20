<?php
/**
 * Email engine dashboard data and queue actions (super/admin).
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

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $status = trim((string)($_GET['status'] ?? 'pending'));
    $days = max(1, min(90, (int)($_GET['days'] ?? 30)));
    $limit = max(1, min(500, (int)($_GET['limit'] ?? 100)));
    $allowedStatus = ['pending', 'retrying', 'sent', 'failed', 'cancelled', 'all'];
    if (!in_array($status, $allowedStatus, true)) {
        $status = 'pending';
    }

    try {
        $overviewStmt = $pdo->prepare("
            SELECT
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN status = 'retrying' THEN 1 ELSE 0 END) AS retrying_count,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent_count,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count
            FROM email_queue
            WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
        ");
        $overviewStmt->execute([$days]);
        $overview = $overviewStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $providerStmt = $pdo->prepare("
            SELECT provider, status, COUNT(*) AS total
            FROM email_log
            WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
            GROUP BY provider, status
            ORDER BY provider ASC, status ASC
        ");
        $providerStmt->execute([$days]);
        $providerRows = $providerStmt->fetchAll(PDO::FETCH_ASSOC);
        $byProvider = [];
        foreach ($providerRows as $row) {
            $provider = $row['provider'] ?: 'unknown';
            if (!isset($byProvider[$provider])) {
                $byProvider[$provider] = ['sent' => 0, 'failed' => 0];
            }
            $st = $row['status'] ?: 'failed';
            $byProvider[$provider][$st] = (int)$row['total'];
        }

        $whereSql = "WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)";
        $params = [$days];
        if ($status !== 'all') {
            $whereSql .= " AND status = ?";
            $params[] = $status;
        }
        $queueSql = "
            SELECT id, recipient_email, template_key, subject, status, attempts, max_attempts, last_error, scheduled_at, sent_at, processed_at, created_at
            FROM email_queue
            {$whereSql}
            ORDER BY id DESC
            LIMIT " . (int)$limit;
        $queueStmt = $pdo->prepare($queueSql);
        $queueStmt->execute($params);
        $queueRows = $queueStmt->fetchAll(PDO::FETCH_ASSOC);

        $recentErrorsStmt = $pdo->prepare("
            SELECT id, recipient_email, provider, error_message, created_at
            FROM email_log
            WHERE status = 'failed' AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
            ORDER BY id DESC
            LIMIT 20
        ");
        $recentErrorsStmt->execute([$days]);
        $recentErrors = $recentErrorsStmt->fetchAll(PDO::FETCH_ASSOC);

        $trendStmt = $pdo->prepare("
            SELECT DATE(created_at) AS day, status, COUNT(*) AS total
            FROM email_log
            WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
            GROUP BY DATE(created_at), status
            ORDER BY day ASC
        ");
        $trendStmt->execute([$days]);
        $trendRows = $trendStmt->fetchAll(PDO::FETCH_ASSOC);
        $trendMap = [];
        foreach ($trendRows as $row) {
            $day = (string)($row['day'] ?? '');
            if ($day === '') {
                continue;
            }
            if (!isset($trendMap[$day])) {
                $trendMap[$day] = ['sent' => 0, 'failed' => 0];
            }
            $st = (string)($row['status'] ?? '');
            if (!isset($trendMap[$day][$st])) {
                $trendMap[$day][$st] = 0;
            }
            $trendMap[$day][$st] = (int)$row['total'];
        }
        ksort($trendMap);
        $trend = [];
        foreach ($trendMap as $day => $vals) {
            $trend[] = [
                'day' => $day,
                'sent' => (int)($vals['sent'] ?? 0),
                'failed' => (int)($vals['failed'] ?? 0),
            ];
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'window_days' => $days,
                'status_filter' => $status,
                'overview' => [
                    'pending' => (int)($overview['pending_count'] ?? 0),
                    'retrying' => (int)($overview['retrying_count'] ?? 0),
                    'sent' => (int)($overview['sent_count'] ?? 0),
                    'failed' => (int)($overview['failed_count'] ?? 0),
                    'cancelled' => (int)($overview['cancelled_count'] ?? 0),
                ],
                'by_provider' => $byProvider,
                'trend' => $trend,
                'queue' => $queueRows,
                'recent_failures' => $recentErrors,
            ]
        ]);
    } catch (Throwable $e) {
        logger('error', 'ADMIN_EMAIL_DASH', 'GET failed: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to load email dashboard data']);
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
    $action = trim((string)($decoded['action'] ?? ''));

    try {
        if ($action === 'retry_failed') {
            $upd = $pdo->exec("
                UPDATE email_queue
                SET status = 'pending', attempts = 0, last_error = NULL, scheduled_at = UTC_TIMESTAMP(), processed_at = NULL
                WHERE status = 'failed'
            ");
            echo json_encode(['success' => true, 'retried_rows' => (int)$upd]);
            exit;
        }

        if ($action === 'retry_ids' || $action === 'cancel_ids') {
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
            if ($action === 'retry_ids') {
                $stmt = $pdo->prepare("
                    UPDATE email_queue
                    SET status = 'pending', attempts = 0, last_error = NULL, scheduled_at = UTC_TIMESTAMP(), processed_at = NULL
                    WHERE id IN ($ph) AND status IN ('failed', 'retrying', 'pending')
                ");
            } else {
                $stmt = $pdo->prepare("
                    UPDATE email_queue
                    SET status = 'cancelled', processed_at = UTC_TIMESTAMP()
                    WHERE id IN ($ph) AND status IN ('failed', 'retrying', 'pending')
                ");
            }
            $stmt->execute($ids);
            echo json_encode(['success' => true, 'affected_rows' => (int)$stmt->rowCount()]);
            exit;
        }
    } catch (Throwable $e) {
        logger('error', 'ADMIN_EMAIL_DASH', 'POST failed: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Action failed']);
        exit;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Unknown action']);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
