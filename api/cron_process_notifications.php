<?php
/**
 * Background worker to process the notification queue.
 * Run via cron or manual trigger: php cron_process_notifications.php
 */

require_once 'db.php';
require_once 'notifications.php';

$notifier = new NotificationService();
$config = $notifier->config;

$heartbeatFile = __DIR__ . '/data/queue_worker_heartbeat.txt';
$heartbeatDir = dirname($heartbeatFile);
if (!is_dir($heartbeatDir)) {
    @mkdir($heartbeatDir, 0755, true);
}

// Limit number of messages per run to avoid timeouts
$limit = 50;

try {
    // 1. Fetch pending notifications
    $stmt = $pdo->prepare("SELECT * FROM notification_queue WHERE status = 'pending' AND scheduled_at <= NOW() ORDER BY created_at ASC LIMIT ?");
    $stmt->bindValue(1, $limit, PDO::PARAM_INT);
    $stmt->execute();
    $queue = $stmt->fetchAll();

    if (empty($queue)) {
        // No pending notifications
        exit;
    }

    foreach ($queue as $item) {
        $success = false;
        $error = null;

        try {
            if ($item['type'] === 'email') {
                $success = $notifier->sendEmail($item['recipient'], $item['subject'], $item['message']);
            } elseif ($item['type'] === 'sms') {
                $success = $notifier->sendSMS($item['recipient'], $item['message']);
            }
        } catch (Exception $e) {
            $error = $e->getMessage();
        }

        if ($success) {
            // Update status to sent
            $upd = $pdo->prepare("UPDATE notification_queue SET status = 'sent', processed_at = NOW() WHERE id = ?");
            $upd->execute([$item['id']]);
        } else {
            // Update attempts and status
            $attempts = $item['attempts'] + 1;
            $status = ($attempts >= 3) ? 'failed' : 'pending';
            $nextSchedule = date('Y-m-d H:i:s', strtotime("+10 minutes")); // Retry after 10 mins

            $upd = $pdo->prepare("UPDATE notification_queue SET status = ?, attempts = ?, last_error = ?, scheduled_at = ? WHERE id = ?");
            $upd->execute([$status, $attempts, $error ?: 'Gateway failure', $nextSchedule, $item['id']]);
            
            logger('error', 'NOTIF_WORKER', "Failed processing #{$item['id']} ({$item['type']} to {$item['recipient']}). Attempt $attempts.");
        }
    }
} catch (Exception $e) {
    logger('error', 'NOTIF_WORKER', "Fatal worker error: " . $e->getMessage());
}

@file_put_contents($heartbeatFile, gmdate('c') . "\n" . (function_exists('gethostname') ? gethostname() : 'worker'), LOCK_EX);
