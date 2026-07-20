<?php

/**
 * super_logs.php
 * System log reader & clearer for the Super User panel.
 * Reads the PHP error_log and any custom app log file.
 *
 * GET  → returns last 200 log entries
 * POST { action: "clear" } → truncates the app log file
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
$logDir = __DIR__ . '/logs';

// Ensure log directory exists
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}

// Ensure at least today's log exists
$todayLog = $logDir . '/app-' . date('Y-m-d') . '.log';
if (!file_exists($todayLog)) {
    file_put_contents($todayLog, '');
}

if ($method === 'GET') {
    try {
        $files = glob($logDir . '/app-*.log');
        rsort($files); // Read newest files first
        $raw = [];
        foreach ($files as $file) {
            $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if ($lines) {
                // Prepend to maintain correct order if we were reading them historically,
                // actually we want latest first? The frontend array_reverses the slice!
                // Wait, frontend does array_reverse(array_slice($raw, -200)). That means it expects chronological order.
                // So if we read older files first, it works out.
                // Let's sort ascending.
            }
        }
        
        // Actually, ascending sort:
        sort($files); 
        $raw = [];
        foreach ($files as $file) {
            $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if ($lines) {
                $raw = array_merge($raw, $lines);
            }
            // Optimization: if $raw is extremely huge, we only need last 200 lines total.
            // But doing it this way is simple and robust.
            // We can just keep the last 500 lines to avoid memory limits if many huge log files.
            if (count($raw) > 1000) {
                $raw = array_slice($raw, -500);
            }
        }

        $lines = array_reverse(array_slice($raw, -200));
        $parsed = [];
        foreach ($lines as $i => $line) {
            // Clean non-UTF8 characters if any
            $line = mb_convert_encoding($line, 'UTF-8', 'UTF-8');

            // Parse: "YYYY-MM-DD HH:MM:SS [level] [SOURCE] [UID:X] message"
            // The UID part is optional.
            // Parse: "YYYY-MM-DD HH:MM:SS [LEVEL] [SOURCE] [METHOD URI] [IP] [UID:X] message"
            if (preg_match('/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+\[(\w+)\]\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s+\[([^\]]+)\](?:\s+\[UID:(\d+)\])?\s+(.+)$/', $line, $m)) {
                $parsed[] = [
                    'id'     => $i + 1,
                    'ts'     => $m[1],
                    'level'  => strtolower($m[2]),
                    'source' => $m[3],
                    'context'=> $m[4],
                    'ip'     => $m[5],
                    'uid'    => isset($m[6]) && $m[6] !== '' ? $m[6] : null,
                    'msg'    => $m[7],
                ];
            } else {
                // Fallback for lines that don't match the pattern exactly
                $parsed[] = [
                    'id'     => $i + 1,
                    'ts'     => date('Y-m-d H:i:s'),
                    'level'  => 'info',
                    'source' => 'SYSTEM',
                    'msg'    => $line,
                ];
            }
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
        $files = glob($logDir . '/app-*.log');
        foreach ($files as $file) {
            unlink($file);
        }
        // If there is an old app.log, remove it
        if (file_exists($logDir . '/app.log')) unlink($logDir . '/app.log');
        file_put_contents($todayLog, '');
        echo json_encode(['success' => true, 'message' => 'All logs cleared.']);
    } elseif ($action === 'delete_day') {
        $date = $body['date'] ?? '';
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $file = $logDir . '/app-' . $date . '.log';
            if (file_exists($file)) unlink($file);
            echo json_encode(['success' => true, 'message' => "Logs for $date deleted."]);
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
