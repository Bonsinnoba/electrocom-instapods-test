<?php
/**
 * api/cron_reconcile_payments.php
 * Background cron to reconcile unpaid pending orders with Paystack.
 * Run this regularly: php cron_reconcile_payments.php
 */

// Define CLI mode
define('CLI_SCRIPT', true);

require_once 'db.php';
require_once 'order_utils.php';

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden']);
    exit;
}

$secretKey = $config['PAYSTACK_SECRET'] ?? "";
if (!$secretKey) {
    if (function_exists('logApp')) {
        logApp('error', 'CRON_RECONCILE', "Paystack secret key is not configured.");
    }
    exit("Paystack key missing\n");
}

try {
    // Fetch pending orders created in the last 60 minutes that have a payment reference
    $stmt = $pdo->prepare("
        SELECT id, payment_reference, total_amount 
        FROM orders 
        WHERE status = 'pending' 
          AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 60 MINUTE)
          AND payment_reference IS NOT NULL
          AND payment_reference != ''
    ");
    $stmt->execute();
    $pendingOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $reconciledCount = 0;

    foreach ($pendingOrders as $order) {
        $orderId = (int)$order['id'];
        $ref = $order['payment_reference'];
        $expectedTotal = (float)$order['total_amount'];

        // Call Paystack Transaction Verification API
        $url = "https://api.paystack.co/transaction/verify/" . rawurlencode($ref);
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Authorization: Bearer " . $secretKey,
            "Cache-Control: no-cache"
        ]);
        
        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || !$result) {
            continue; // Skip if API is temporarily unavailable or returns 404 for unpaid references
        }

        $res = json_decode($result, true);
        if ($res && isset($res['data']) && $res['data']['status'] === 'success') {
            // Verify paid amount matches expected total (converting kobo/cents to major GHS currency)
            $paidAmount = (float)($res['data']['amount'] / 100);
            if (abs($paidAmount - $expectedTotal) > 0.10) {
                if (function_exists('logApp')) {
                    logApp('warning', 'CRON_RECONCILE', "Amount mismatch for Order #{$orderId} (Ref: {$ref}). Expected: GHS {$expectedTotal}, Paid: GHS {$paidAmount}");
                }
                continue;
            }

            // Paystack transaction is successful and matches amount. Complete the order!
            if (completeOrder($orderId, $pdo)) {
                $reconciledCount++;
                if (function_exists('logApp')) {
                    logApp('ok', 'CRON_RECONCILE', "Successfully reconciled and completed Order #{$orderId} (Ref: {$ref})");
                }
            }
        }
    }

    if ($reconciledCount > 0 && function_exists('logApp')) {
        logApp('info', 'CRON_RECONCILE', "Reconciliation finished. Completed {$reconciledCount} unpaid pending orders.");
    }

} catch (Exception $e) {
    if (function_exists('logApp')) {
        logApp('error', 'CRON_RECONCILE', "Reconciliation failed with error: " . $e->getMessage());
    }
    error_log("Reconciliation error: " . $e->getMessage());
}
