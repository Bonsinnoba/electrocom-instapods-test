<?php

/**
 * super_logs.php
 * System log reader & clearer for the Super User panel.
 * Reads from the system_logs database table.
 *
 * GET  → returns last 200 log entries
 * POST { action: "clear" } → deletes all log entries
 * POST { action: "delete_day", date: "YYYY-MM-DD" } → deletes entries for one day
 */

require 'cors_middleware.php';
require 'db.php';
require 'security.php';
header('Content-Type: application/json');

try {
    $userId = requireRole('super', $pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

// Self-heal: same table logger() writes to.
$pdo->exec("CREATE TABLE IF NOT EXISTS system_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    level VARCHAR(20) NOT NULL,
    source VARCHAR(100) NOT NULL,
    method_uri VARCHAR(500) DEFAULT NULL,
    ip VARCHAR(45) DEFAULT NULL,
    user_id INT DEFAULT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created_at (created_at),
    INDEX idx_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

if ($method === 'GET') {
    try {
        $stmt = $pdo->prepare("
            SELECT id, level, source, method_uri, ip, user_id, message, created_at
            FROM system_logs
            ORDER BY created_at DESC, id DESC
            LIMIT 200
        ");
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $parsed = [];
        foreach ($rows as $row) {
            $parsed[] = [
                'id'      => (int)$row['id'],
                'ts'      => $row['created_at'],
                'level'   => strtolower($row['level']),
                'source'  => $row['source'],
                'context' => $row['method_uri'],
                'ip'      => $row['ip'],
                'uid'     => $row['user_id'] !== null ? (int)$row['user_id'] : null,
                'msg'     => $row['message'],
            ];
        }
        echo json_encode(['success' => true, 'data' => $parsed]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
} elseif ($method === 'POST') {
    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $body['action'] ?? '';

    if ($action === 'clear') {
        try {
            $pdo->exec("TRUNCATE TABLE system_logs");
            echo json_encode(['success' => true, 'message' => 'All logs cleared.']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to clear logs.']);
        }
    } elseif ($action === 'delete_day') {
        $date = $body['date'] ?? '';
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            try {
                $stmt = $pdo->prepare("DELETE FROM system_logs WHERE DATE(created_at) = ?");
                $stmt->execute([$date]);
                echo json_encode(['success' => true, 'message' => "Logs for $date deleted."]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to delete logs for that day.']);
            }
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid date format.']);
        }
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Unknown action.']);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
}
