<?php
/**
 * Scheduled health alerts for super admins (SMS queue failures, disk, log volume).
 * Run from cron e.g. every 15 minutes: php cron_super_health.php
 */
require_once 'db.php';

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0755, true);
}
$stateFile = $dataDir . '/super_health_state.json';
$state = [];
if (is_readable($stateFile)) {
    $state = json_decode((string)file_get_contents($stateFile), true) ?: [];
}

function superAlertThrottle($state, $key, $minutes = 360)
{
    $last = $state['throttle'][$key] ?? 0;
    return (time() - (int)$last) < ($minutes * 60);
}

function saveSuperHealthState($stateFile, $state)
{
    @file_put_contents($stateFile, json_encode($state), LOCK_EX);
}

function notifySupers($pdo, $title, $message)
{
    try {
        $stmt = $pdo->prepare("
            INSERT INTO notifications (user_id, title, message, type)
            SELECT id, ?, ?, 'security' FROM users WHERE role = 'super'
        ");
        $stmt->execute([$title, $message]);
    } catch (Exception $e) {
        error_log('super health notify failed: ' . $e->getMessage());
    }
}

try {
    // SMS failures in the last hour
    $fStmt = $pdo->query("
        SELECT COUNT(*) FROM notification_queue
        WHERE type = 'sms' AND status = 'failed'
          AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    ");
    $smsFailed = (int)$fStmt->fetchColumn();
    if ($smsFailed >= 3 && !superAlertThrottle($state, 'sms_fail', 240)) {
        notifySupers($pdo, 'SMS queue failures', "There were {$smsFailed} failed SMS queue rows in the last hour. Check admin notification queue and provider config.");
        $state['throttle']['sms_fail'] = time();
    }

    $free = @disk_free_space(__DIR__);
    $total = @disk_total_space(__DIR__);
    if ($free !== false && $total > 0) {
        $pctFree = ($free / $total) * 100;
        if ($pctFree < 8 && !superAlertThrottle($state, 'disk_low', 720)) {
            notifySupers($pdo, 'Low disk space', 'Server disk free space is below 8%. Plan cleanup or expand storage.');
            $state['throttle']['disk_low'] = time();
        }
    }

    $logDir = __DIR__ . '/logs';
    $logBytes = 0;
    if (is_dir($logDir)) {
        foreach (glob($logDir . '/*.log') ?: [] as $lf) {
            if (is_file($lf)) {
                $logBytes += @filesize($lf) ?: 0;
            }
        }
    }
    if ($logBytes > 80 * 1024 * 1024 && !superAlertThrottle($state, 'logs_large', 720)) {
        notifySupers($pdo, 'Large log volume', 'Application logs exceed ~80MB. Run hygiene job or rotate logs.');
        $state['throttle']['logs_large'] = time();
    }

    saveSuperHealthState($stateFile, $state);
} catch (Exception $e) {
    error_log('cron_super_health: ' . $e->getMessage());
}
