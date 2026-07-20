<?php
/**
 * ElectrCom - System Status & Health Check
 */

require_once 'db.php';

header('Content-Type: application/json');

$status = [
    'system' => 'online',
    'timestamp' => date('Y-m-d H:i:s'),
    'environment' => $config['APP_ENV'] ?? 'unknown',
    'checks' => []
];

// 1. Database Check
try {
    $q = $pdo->query("SELECT 1");
    if ($q) {
        $status['checks']['database'] = [
            'status' => 'connected',
            'latency' => 'low'
        ];
    }
} catch (Exception $e) {
    $status['system'] = 'degraded';
    $status['checks']['database'] = [
        'status' => 'failed',
        'error' => $e->getMessage()
    ];
}

// 2. Storage Check
$uploadsDir = __DIR__ . '/uploads';
$status['checks']['storage'] = [
    'uploads_writable' => is_writable($uploadsDir),
    'free_space' => disk_free_space(__DIR__)
];

// 3. Mail Config Check (Basic)
$status['checks']['mail'] = [
    'configured' => !empty($config['SMTP_HOST']),
    'provider' => $config['SMTP_HOST'] ?: 'None (Mail Fallback)',
    'delivery_mode' => ($config['APP_ENV'] === 'development') ? 'Immediate (Dev Sync)' : 'Queued (Background)'
];

// 4. Notification Queue Check
try {
    $countStmt = $pdo->query("SELECT status, COUNT(*) as cnt FROM notification_queue GROUP BY status");
    $counts = $countStmt->fetchAll(PDO::FETCH_KEY_PAIR);
    $status['checks']['notifications'] = [
        'pending' => (int)($counts['pending'] ?? 0),
        'sent' => (int)($counts['sent'] ?? 0),
        'failed' => (int)($counts['failed'] ?? 0)
    ];
} catch (Exception $e) {
    $status['checks']['notifications'] = 'not_installed';
}

// 5. Queue worker heartbeat (updated by cron_process_notifications.php)
$hbFile = __DIR__ . '/data/queue_worker_heartbeat.txt';
$status['checks']['queue_worker'] = ['heartbeat_file' => false, 'last_run' => null, 'stale' => true];
if (is_readable($hbFile)) {
    $status['checks']['queue_worker']['heartbeat_file'] = true;
    $rawHb = @file_get_contents($hbFile);
    $firstLine = $rawHb ? trim(explode("\n", $rawHb)[0]) : '';
    $status['checks']['queue_worker']['last_run'] = $firstLine ?: null;
    $ts = @strtotime($firstLine . ' UTC');
    if ($ts && (time() - $ts) < 900) {
        $status['checks']['queue_worker']['stale'] = false;
    }
}

// 6. API process (this request)
$status['checks']['api'] = ['status' => 'ok', 'pid' => getmypid()];

// 7. Log volume (rough size of api/logs)
$logDir = __DIR__ . '/logs';
$logBytes = 0;
if (is_dir($logDir)) {
    foreach (glob($logDir . '/*.log') ?: [] as $lf) {
        if (is_file($lf)) {
            $logBytes += @filesize($lf) ?: 0;
        }
    }
}
$status['checks']['logs'] = [
    'total_bytes' => $logBytes,
    'high_volume' => $logBytes > 50 * 1024 * 1024,
];

$notifPending = is_array($status['checks']['notifications'] ?? null)
    ? (int)($status['checks']['notifications']['pending'] ?? 0)
    : 0;
if (($status['checks']['queue_worker']['stale'] ?? false) && $notifPending > 5) {
    $status['system'] = 'degraded';
}

$httpCode = ($status['system'] === 'online') ? 200 : 503;
http_response_code($httpCode);
echo json_encode($status, JSON_PRETTY_PRINT);
