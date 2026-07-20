<?php
/**
 * Paystack Webhook Handler
 * This script handles asynchronous notifications from Paystack.
 * It does NOT require user authentication via session/cookie.
 * 
 * Implements DLQ pattern: Store webhook first, then process.
 * Prevents webhook silent death if server crashes during processing.
 */

require_once 'db.php';
require_once 'security.php';
require_once 'order_utils.php';

// Disable error reporting for cleaner output to Paystack
error_reporting(0);

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    exit;
}

// 1. Validate Paystack Signature
$secretKey = $config['PAYSTACK_SECRET'] ?? "";

if (!$secretKey) {
    logger('error', 'WEBHOOK', "Paystack Secret Key is missing in .env.php");
    exit;
}

$input = file_get_contents("php://input");
$paystackSignature = $_SERVER['HTTP_X_PAYSTACK_SIGNATURE'] ?? '';

if ($paystackSignature !== hash_hmac('sha256', $input, $secretKey)) {
    logger('warning', 'WEBHOOK', "Invalid Paystack signature received.");
    http_response_code(401);
    exit;
}

// 2. Parse Event Data
$event = json_decode($input, true);

if (!$event || !isset($event['event'])) {
    exit;
}

$eventType = $event['event'];
$eventId = $event['id'] ?? '';

// 3. Store webhook in DLQ table first (idempotency by event_id)
try {
    $pdo->beginTransaction();
    
    // Check if already processed
    $checkStmt = $pdo->prepare("SELECT id, status FROM webhook_events WHERE event_id = ? LIMIT 1");
    $checkStmt->execute([$eventId]);
    $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($existing) {
        if ($existing['status'] === 'completed') {
            $pdo->rollBack();
            logger('ok', 'WEBHOOK', "Event {$eventId} already completed - skipping.");
            http_response_code(200);
            exit;
        }
        // If failed or pending, update payload and retry
        $updateStmt = $pdo->prepare("UPDATE webhook_events SET payload = ?, status = 'pending', attempts = 0, error_message = NULL WHERE id = ?");
        $updateStmt->execute([json_encode($event), $existing['id']]);
        $webhookEventId = $existing['id'];
    } else {
        // Insert new webhook event
        $insertStmt = $pdo->prepare("INSERT INTO webhook_events (event_type, event_id, payload, status) VALUES (?, ?, ?, 'pending')");
        $insertStmt->execute([$eventType, $eventId, json_encode($event)]);
        $webhookEventId = $pdo->lastInsertId();
    }
    
    $pdo->commit();
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    logger('error', 'WEBHOOK', "Failed to store webhook event: " . $e->getMessage());
    http_response_code(500);
    exit;
}

// 4. Acknowledge receipt early (Paystack expects 200)
http_response_code(200);

/**
 * Map a Paystack refund event to an internal refunds.status value.
 * Returns null if the event should be ignored.
 */
function paystackEventToRefundStatus(string $eventName): ?string
{
    return match ($eventName) {
        'refund.processed' => 'processed',
        'refund.failed'    => 'failed',
        'refund.pending'   => 'pending',
        default            => null,
    };
}

// 5. Process the webhook (can fail safely since it's stored)
try {
    // Mark as processing
    $pdo->prepare("UPDATE webhook_events SET status = 'processing' WHERE id = ?")->execute([$webhookEventId]);

    // ─── charge.success ──────────────────────────────────────────────────────────
    if ($event['event'] === 'charge.success') {
        $data = $event['data'];
        $reference = $data['reference'];
        $amountPaid = $data['amount'] / 100; // kobo to GHS
        $customerEmail = $data['customer']['email'];

        // Find user by email (as fallback) or metadata if we sent user_id in payload
        $userId = $data['metadata']['user_id'] ?? null;
        if (!$userId) {
            $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$customerEmail]);
            $userId = $stmt->fetchColumn();
        }

        if (!$userId) {
            throw new Exception("Could not find user for email: $customerEmail (Ref: $reference)");
        }

        // Check if reference already processed
        $stmt = $pdo->prepare("SELECT id, status FROM orders WHERE payment_reference = ?");
        $stmt->execute([$reference]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($order) {
            completeOrder($order['id'], $pdo);
            logger('ok', 'WEBHOOK', "Order #{$order['id']} completed via webhook.");
        } else {
            // Handle other payment types if necessary in the future
        }
    }

    // ─── Refund lifecycle events ──────────────────────────────────────────────────
    $newStatus = paystackEventToRefundStatus($event['event']);

    if ($newStatus !== null) {
        $data = $event['data'] ?? [];

        // Paystack puts the refund object inside data.
        // The refund id can appear as data.id or data.refund.id depending on event version.
        $paystackRefundId = (string)($data['id'] ?? $data['refund']['id'] ?? '');
        $paystackTxRef    = $data['transaction']['reference'] ?? $data['reference'] ?? '';
        $amountGhs        = isset($data['amount']) ? round((int)$data['amount'] / 100, 2) : null;

        if (empty($paystackRefundId) && empty($paystackTxRef)) {
            throw new Exception("Refund event '{$event['event']}' received with no identifiable reference.");
        }

        // Find the matching row in our refunds table.
        // Primary lookup: by gateway_ref (the Paystack refund ID we stored at issue time).
        // Fallback: by matching the order's payment_reference (transaction ref).
        $refundRow = null;

        if ($paystackRefundId !== '') {
            $stmt = $pdo->prepare('SELECT id, order_id, status FROM refunds WHERE gateway_ref = ? LIMIT 1');
            $stmt->execute([$paystackRefundId]);
            $refundRow = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        if (!$refundRow && $paystackTxRef !== '') {
            // Fallback: match via the order's payment_reference
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

        if (!$refundRow) {
            throw new Exception("No matching refund row for event '{$event['event']}' (gateway_ref={$paystackRefundId}, tx_ref={$paystackTxRef}).");
        }

        // Only update if the status is actually changing (avoid redundant writes).
        if ($refundRow['status'] === $newStatus) {
            logger('ok', 'WEBHOOK_REFUND', "Refund #{$refundRow['id']} already in status '{$newStatus}' — skipping.");
        } else {
            $processedAt = $newStatus === 'processed' ? date('Y-m-d H:i:s') : null;

            $upd = $pdo->prepare('
                UPDATE refunds
                SET status       = ?,
                    processed_at = COALESCE(processed_at, ?)
                WHERE id = ?
            ');
            $upd->execute([$newStatus, $processedAt, $refundRow['id']]);

            $logMsg = "Refund #{$refundRow['id']} on ORD-{$refundRow['order_id']} → status '{$newStatus}'";
            if ($amountGhs !== null) {
                $logMsg .= " (GHS {$amountGhs})";
            }
            if ($newStatus === 'failed') {
                $logMsg .= '. Amount returned to merchant Paystack balance — manual cash refund may be needed.';
            }

            logger('ok', 'WEBHOOK_REFUND', $logMsg);

            // ── If the refund failed, notify the customer and flag admins ────────────
            if ($newStatus === 'failed') {
                try {
                    require_once __DIR__ . '/email/EmailEngine.php';
                    require_once __DIR__ . '/notifications.php';
                    require_once __DIR__ . '/config.php';

                    $config = require __DIR__ . '/config.php';

                    // Fetch customer details via the order
                    $custStmt = $pdo->prepare('
                        SELECT u.email, u.name AS customer_name,
                               o.id AS order_id, o.payment_method,
                               r.amount AS refund_amount
                        FROM refunds r
                        JOIN orders o ON o.id = r.order_id
                        JOIN users u  ON u.id = o.user_id
                        WHERE r.id = ?
                        LIMIT 1
                    ');
                    $custStmt->execute([$refundRow['id']]);
                    $custRow = $custStmt->fetch(PDO::FETCH_ASSOC);

                    if ($custRow && !empty($custRow['email'])) {
                        // Map payment_method to a human-readable label
                        $methodLabel = match (strtolower((string)($custRow['payment_method'] ?? ''))) {
                            'paystack', 'card' => 'your card via Paystack',
                            'momo'             => 'Mobile Money (MoMo)',
                            'cash'             => 'cash',
                            default            => 'your original payment method',
                        };

                        $engine = new EmailEngine($pdo, $config);
                        $engine->queueTemplate(
                            $custRow['email'],
                            'refund_failed',
                            [
                                'customer_name'   => $custRow['customer_name'] ?? 'Valued Customer',
                                'order_id'        => $custRow['order_id'],
                                'amount'          => number_format((float)($custRow['refund_amount'] ?? $amountGhs ?? 0), 2),
                                'original_method' => $methodLabel,
                                'support_email'   => $config['MAIL_FROM'] ?? '',
                                'store_url'       => $config['APP_URL'] ?? '',
                            ]
                        );

                        logger('ok', 'WEBHOOK_REFUND', "Refund-failed email queued for {$custRow['email']} (ORD-{$custRow['order_id']}).");

                        // Push in-app alert to all admins/super users
                        $notif = new NotificationService();
                        $notif->logAdminNotification(
                            '⚠ Refund Failed – Action Required',
                            "Refund #{$refundRow['id']} of GHS " . number_format((float)($custRow['refund_amount'] ?? $amountGhs ?? 0), 2)
                            . " on ORD-{$custRow['order_id']} was rejected by the payment network (e.g. prepaid card). "
                            . "The customer ({$custRow['email']}) has been notified. Please arrange a manual refund.",
                            'error'
                        );
                    }
                } catch (Throwable $emailErr) {
                    logger('error', 'WEBHOOK_REFUND', 'Failed to send refund-failed notification: ' . $emailErr->getMessage());
                }
            }
        }
    }

    // Mark webhook as completed
    $pdo->prepare("UPDATE webhook_events SET status = 'completed', processed_at = NOW() WHERE id = ?")->execute([$webhookEventId]);
    logger('ok', 'WEBHOOK', "Webhook event {$eventId} processed successfully.");

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    
    // Mark webhook as failed and increment attempts
    $attemptsStmt = $pdo->prepare("UPDATE webhook_events SET status = 'failed', attempts = attempts + 1, error_message = ? WHERE id = ?");
    $attemptsStmt->execute([$e->getMessage(), $webhookEventId]);
    
    logger('error', 'WEBHOOK', "Webhook processing failed for event {$eventId}: " . $e->getMessage());
}

exit;

