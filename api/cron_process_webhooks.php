<?php
/**
 * Background worker to process failed/pending webhook events.
 * Run via cron or manual trigger: php cron_process_webhooks.php
 * 
 * This implements the retry mechanism for the DLQ pattern.
 * If webhook processing failed (server crash, timeout, etc.), this cron job
 * will retry processing failed webhook events.
 */

require_once 'db.php';
require_once 'order_utils.php';

$heartbeatFile = __DIR__ . '/data/webhook_worker_heartbeat.txt';
$heartbeatDir = dirname($heartbeatFile);
if (!is_dir($heartbeatDir)) {
    @mkdir($heartbeatDir, 0755, true);
}

// Limit number of webhooks per run to avoid timeouts
$limit = 20;

try {
    // 1. Fetch pending or failed webhook events (with retry limit)
    // Retry events that failed less than 5 times
    $stmt = $pdo->prepare("
        SELECT * FROM webhook_events 
        WHERE status IN ('pending', 'failed') 
        AND attempts < 5
        ORDER BY created_at ASC 
        LIMIT ?
    ");
    $stmt->bindValue(1, $limit, PDO::PARAM_INT);
    $stmt->execute();
    $webhooks = $stmt->fetchAll();

    if (empty($webhooks)) {
        // No webhooks to process
        exit;
    }

    foreach ($webhooks as $webhook) {
        $webhookId = $webhook['id'];
        $eventId = $webhook['event_id'];
        $eventType = $webhook['event_type'];
        $payload = json_decode($webhook['payload'], true);

        if (!$payload) {
            logger('error', 'WEBHOOK_WORKER', "Invalid JSON payload for webhook #{$webhookId}");
            continue;
        }

        try {
            // Mark as processing
            $pdo->prepare("UPDATE webhook_events SET status = 'processing' WHERE id = ?")->execute([$webhookId]);

            // Process based on event type
            if ($eventType === 'charge.success') {
                $data = $payload['data'];
                $reference = $data['reference'];
                $customerEmail = $data['customer']['email'];

                // Find user by email
                $userId = $data['metadata']['user_id'] ?? null;
                if (!$userId) {
                    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
                    $stmt->execute([$customerEmail]);
                    $userId = $stmt->fetchColumn();
                }

                if ($userId) {
                    $stmt = $pdo->prepare("SELECT id, status FROM orders WHERE payment_reference = ?");
                    $stmt->execute([$reference]);
                    $order = $stmt->fetch(PDO::FETCH_ASSOC);

                    if ($order) {
                        completeOrder($order['id'], $pdo);
                        logger('ok', 'WEBHOOK_WORKER', "Order #{$order['id']} completed via webhook retry (event: {$eventId}).");
                    }
                }
            } elseif (str_starts_with($eventType, 'refund.')) {
                // Handle refund events
                $newStatus = match ($eventType) {
                    'refund.processed' => 'processed',
                    'refund.failed'    => 'failed',
                    'refund.pending'   => 'pending',
                    default            => null,
                };

                if ($newStatus !== null) {
                    $data = $payload['data'] ?? [];
                    $paystackRefundId = (string)($data['id'] ?? $data['refund']['id'] ?? '');
                    $paystackTxRef = $data['transaction']['reference'] ?? $data['reference'] ?? '';

                    if (!empty($paystackRefundId) || !empty($paystackTxRef)) {
                        $refundRow = null;

                        if ($paystackRefundId !== '') {
                            $stmt = $pdo->prepare('SELECT id, order_id, status FROM refunds WHERE gateway_ref = ? LIMIT 1');
                            $stmt->execute([$paystackRefundId]);
                            $refundRow = $stmt->fetch(PDO::FETCH_ASSOC);
                        }

                        if (!$refundRow && $paystackTxRef !== '') {
                            $stmt = $pdo->prepare('
                                SELECT r.id, r.order_id, r.status
                                FROM refunds r
                                JOIN orders o ON o.id = r.order_id
                                WHERE o.payment_reference = ?
                                  AND r.status = "processed"
                                ORDER BY r.created_at DESC
                                LIMIT 1
                            ');
                            $stmt->execute([$paystackTxRef]);
                            $refundRow = $stmt->fetch(PDO::FETCH_ASSOC);
                        }

                        if ($refundRow && $refundRow['status'] !== $newStatus) {
                            $processedAt = $newStatus === 'processed' ? date('Y-m-d H:i:s') : null;
                            $upd = $pdo->prepare('
                                UPDATE refunds
                                SET status = ?, processed_at = COALESCE(processed_at, ?)
                                WHERE id = ?
                            ');
                            $upd->execute([$newStatus, $processedAt, $refundRow['id']]);
                            logger('ok', 'WEBHOOK_WORKER', "Refund #{$refundRow['id']} updated to {$newStatus} via webhook retry (event: {$eventId}).");
                        }
                    }
                }
            }

            // Mark webhook as completed
            $pdo->prepare("UPDATE webhook_events SET status = 'completed', processed_at = NOW() WHERE id = ?")->execute([$webhookId]);
            logger('ok', 'WEBHOOK_WORKER', "Webhook #{$webhookId} ({$eventType}) processed successfully on retry.");

        } catch (Exception $e) {
            // Increment attempts and mark as failed
            $attempts = $webhook['attempts'] + 1;
            $status = ($attempts >= 5) ? 'failed' : 'pending';
            $nextSchedule = date('Y-m-d H:i:s', strtotime("+15 minutes"));

            $upd = $pdo->prepare("UPDATE webhook_events SET status = ?, attempts = ?, error_message = ? WHERE id = ?");
            $upd->execute([$status, $attempts, $e->getMessage(), $webhookId]);
            
            logger('error', 'WEBHOOK_WORKER', "Failed processing webhook #{$webhookId} ({$eventType}) on attempt {$attempts}: " . $e->getMessage());

            if ($status === 'failed') {
                try {
                    require_once 'notifications.php';
                    $notif = new NotificationService();
                    $notif->logAdminNotification(
                        '⚠ Webhook DLQ Alert – Action Required',
                        "Webhook #{$webhookId} ({$eventType}) failed after 5 retries. Error: " . $e->getMessage() . ". Please check orders and reconcile manually.",
                        'error'
                    );
                } catch (Exception $notifErr) {
                    logger('error', 'WEBHOOK_WORKER', "Failed to send DLQ admin notification: " . $notifErr->getMessage());
                }
            }
        }
    }
} catch (Exception $e) {
    logger('error', 'WEBHOOK_WORKER', "Fatal worker error: " . $e->getMessage());
}

@file_put_contents($heartbeatFile, gmdate('c') . "\n" . (function_exists('gethostname') ? gethostname() : 'webhook_worker'), LOCK_EX);
