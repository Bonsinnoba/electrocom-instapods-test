<?php
/**
 * admin_refund.php
 * Issue a refund for an order that has an associated return record.
 *
 * Roles allowed: super, store_manager
 *
 * POST body:
 *   {
 *     "order_id":   42,
 *     "return_id":  7,          // optional – links to a specific order_returns row
 *     "amount":     50.00,      // GHS – must be <= order total, validated server-side
 *     "method":     "paystack"  // "paystack" | "cash" | "store_credit"
 *     "note":       "..."       // optional
 *   }
 *
 * GET ?order_id=42
 *   Returns refund history + refundable amount for that order.
 */

require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

// ─── Auth ────────────────────────────────────────────────────────────────────
try {
    $staffId = authenticate($pdo);
    $stmt    = $pdo->prepare('SELECT role, name FROM users WHERE id = ?');
    $stmt->execute([$staffId]);
    $staff   = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$staff || !in_array($staff['role'], ['super', 'store_manager'], true)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden: Only authorized staff can process refunds.']);
        exit;
    }
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized: ' . $e->getMessage()]);
    exit;
}

// ─── Paystack helper ─────────────────────────────────────────────────────────
/**
 * Call the Paystack Refund API.
 * Amounts in GHS (we convert to kobo internally).
 *
 * @return array{success: bool, gateway_ref: string|null, message: string}
 */
function paystackRefund(string $secretKey, string $paystackReference, float $amountGhs): array
{
    $amountKobo = (int)round($amountGhs * 100);

    $payload = json_encode([
        'transaction' => $paystackReference,
        'amount'      => $amountKobo,
    ]);

    $ch = curl_init('https://api.paystack.co/refund');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $secretKey,
            'Content-Type: application/json',
            'Cache-Control: no-cache',
        ],
        CURLOPT_TIMEOUT => 30,
    ]);

    $raw   = curl_exec($ch);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        return ['success' => false, 'gateway_ref' => null, 'message' => 'Gateway connection error: ' . $curlErr];
    }

    $res = json_decode($raw, true);

    if (!$res || !($res['status'] ?? false)) {
        $msg = $res['message'] ?? 'Paystack returned an unexpected response.';
        return ['success' => false, 'gateway_ref' => null, 'message' => $msg];
    }

    // Paystack refund object is in $res['data']
    $gatewayRef = $res['data']['id'] ?? null; // numeric refund ID from Paystack

    return [
        'success'     => true,
        'gateway_ref' => $gatewayRef !== null ? (string)$gatewayRef : null,
        'message'     => 'Refund submitted to Paystack successfully.',
    ];
}

// ─── GET – fetch refund history for an order ─────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $orderId = (int)($_GET['order_id'] ?? 0);
    if ($orderId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Valid order_id required']);
        exit;
    }

    try {
        // Order meta
        $oStmt = $pdo->prepare('SELECT id, total_amount, payment_method, payment_reference, status FROM orders WHERE id = ?');
        $oStmt->execute([$orderId]);
        $order = $oStmt->fetch(PDO::FETCH_ASSOC);

        if (!$order) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Order not found']);
            exit;
        }

        // ── Refundable ceiling: sum of actually-returned item values ──
        // Only count returns that were processed or inspected (not rejected).
        $ceilStmt = $pdo->prepare('
            SELECT COALESCE(SUM(r.quantity * oi.price_at_purchase), 0)
            FROM order_returns r
            JOIN order_items oi ON oi.order_id = r.order_id AND oi.product_id = r.product_id
            WHERE r.order_id = ?
              AND r.status IN ("processed", "inspected")
        ');
        $ceilStmt->execute([$orderId]);
        $returnedValueTotal = (float)$ceilStmt->fetchColumn();

        // Already refunded (non-failed)
        $rStmt = $pdo->prepare('SELECT COALESCE(SUM(amount), 0) FROM refunds WHERE order_id = ? AND status != "failed"');
        $rStmt->execute([$orderId]);
        $alreadyRefunded = (float)$rStmt->fetchColumn();

        // Refund history rows
        $hStmt = $pdo->prepare('
            SELECT r.*, u.name AS approved_by_name
            FROM refunds r
            JOIN users u ON u.id = r.approved_by
            WHERE r.order_id = ?
            ORDER BY r.created_at DESC
        ');
        $hStmt->execute([$orderId]);
        $history = $hStmt->fetchAll(PDO::FETCH_ASSOC);

        // Returns list (so UI can display what was actually returned)
        $retStmt = $pdo->prepare('
            SELECT r.id, r.product_id, r.quantity, r.status, r.reason, r.created_at,
                   p.name AS product_name,
                   oi.price_at_purchase,
                   (r.quantity * oi.price_at_purchase) AS line_value
            FROM order_returns r
            JOIN products p ON p.id = r.product_id
            JOIN order_items oi ON oi.order_id = r.order_id AND oi.product_id = r.product_id
            WHERE r.order_id = ?
            ORDER BY r.created_at DESC
        ');
        $retStmt->execute([$orderId]);
        $returns = $retStmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success'              => true,
            'order'                => $order,
            'returned_value_total' => round($returnedValueTotal, 2),
            'already_refunded'     => round($alreadyRefunded, 2),
            'refundable'           => max(0, round($returnedValueTotal - $alreadyRefunded, 2)),
            'returns'              => $returns,
            'history'              => $history,
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Lookup failed: ' . $e->getMessage()]);
    }
    exit;
}

// ─── POST – issue a refund ────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
    exit;
}

$orderId   = (int)($data['order_id'] ?? 0);
$returnIds = isset($data['return_ids']) && is_array($data['return_ids']) ? $data['return_ids'] : [];
if (isset($data['return_id']) && empty($returnIds)) {
    $returnIds[] = (int)$data['return_id'];
}
$amount    = round((float)($data['amount'] ?? 0), 2);
$method    = sanitizeInput($data['method'] ?? '');
$note      = sanitizeInput($data['note'] ?? '');

if ($orderId <= 0 || $amount <= 0 || !in_array($method, ['paystack', 'cash', 'store_credit'], true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'order_id, a positive amount, and method (paystack|cash|store_credit) are required.']);
    exit;
}

try {
    $pdo->beginTransaction();

    // 1. Lock and fetch the order
    $oStmt = $pdo->prepare('SELECT id, total_amount, payment_method, payment_reference FROM orders WHERE id = ? FOR UPDATE');
    $oStmt->execute([$orderId]);
    $order = $oStmt->fetch(PDO::FETCH_ASSOC);

    if (!$order) {
        throw new Exception('Order not found.');
    }

    // 2. Verify legitimacy: at least one processed/inspected return must exist for this order.
    //    This is the proof that the goods were physically returned before any money goes out.
    $legitimacyStmt = $pdo->prepare("
        SELECT COUNT(*) FROM order_returns
        WHERE order_id = ? AND status IN ('processed', 'inspected')
    ");
    $legitimacyStmt->execute([$orderId]);
    if ((int)$legitimacyStmt->fetchColumn() === 0) {
        throw new Exception(
            'No confirmed return records found for this order. '
            . 'A return must be processed and confirmed before a refund can be issued.'
        );
    }

    // 3. If specific return_ids are provided, validate they belong to this order and are confirmed.
    $primaryReturnId = null;
    if (!empty($returnIds)) {
        $primaryReturnId = (int)$returnIds[0];
        $placeholders = implode(',', array_fill(0, count($returnIds), '?'));
        $retChk = $pdo->prepare("
            SELECT id FROM order_returns
            WHERE id IN ($placeholders) AND order_id = ? AND status IN ('processed', 'inspected')
        ");
        $chkParams = $returnIds;
        $chkParams[] = $orderId;
        $retChk->execute($chkParams);
        $validReturns = $retChk->fetchAll(PDO::FETCH_COLUMN);
        
        if (count($validReturns) !== count($returnIds)) {
            throw new Exception('One or more return_ids are invalid, belong to a different order, or have not been confirmed.');
        }
        
        if (count($returnIds) > 1) {
            $note .= " (Batch Returns: " . implode(', ', $returnIds) . ")";
        }
    }

    // 4. Compute refundable ceiling from actual returned item values (qty × price_at_purchase).
    //    This prevents refunding more than what was physically returned, regardless of order total.
    $ceilStmt = $pdo->prepare("
        SELECT COALESCE(SUM(r.quantity * oi.price_at_purchase), 0)
        FROM order_returns r
        JOIN order_items oi ON oi.order_id = r.order_id AND oi.product_id = r.product_id
        WHERE r.order_id = ?
          AND r.status IN ('processed', 'inspected')
    ");
    $ceilStmt->execute([$orderId]);
    $returnedValueTotal = (float)$ceilStmt->fetchColumn();

    $alreadyRefundedStmt = $pdo->prepare('SELECT COALESCE(SUM(amount), 0) FROM refunds WHERE order_id = ? AND status != "failed"');
    $alreadyRefundedStmt->execute([$orderId]);
    $alreadyRefunded = (float)$alreadyRefundedStmt->fetchColumn();

    $refundable = round($returnedValueTotal - $alreadyRefunded, 2);

    if ($refundable <= 0) {
        throw new Exception('All returned item value has already been refunded for this order.');
    }

    if ($amount > $refundable) {
        throw new Exception(
            "Refund amount GHS {$amount} exceeds the refundable balance of GHS {$refundable} "
            . "(based on returned item values, minus GHS {$alreadyRefunded} already refunded)."
        );
    }

    // 4. Process via gateway
    $gatewayRef = null;
    $status     = 'pending';

    if ($method === 'paystack') {
        $secretKey = $config['PAYSTACK_SECRET'] ?? '';
        if (empty($secretKey)) {
            throw new Exception('Paystack secret key is not configured.');
        }

        $paystackRef = $order['payment_reference'] ?? '';
        if (empty($paystackRef)) {
            throw new Exception('This order has no Paystack payment reference. Cannot issue a gateway refund — use cash instead.');
        }

        $result = paystackRefund($secretKey, $paystackRef, $amount);

        if (!$result['success']) {
            // Insert a failed record for audit trail, then surface the error
            $pdo->prepare('INSERT INTO refunds (order_id, return_id, amount, method, status, approved_by, note) VALUES (?, ?, ?, ?, "failed", ?, ?)')
                ->execute([$orderId, $primaryReturnId, $amount, $method, $staffId, 'Gateway error: ' . $result['message']]);
            $pdo->commit();
            http_response_code(502);
            echo json_encode(['success' => false, 'message' => $result['message']]);
            exit;
        }

        $gatewayRef = $result['gateway_ref'];
        $status     = 'processed';
    } elseif ($method === 'cash') {
        // No gateway call – staff confirms physical cash was returned
        $status = 'processed';
    } elseif ($method === 'store_credit') {
        // Convert refund amount to loyalty points (1 point per GHS 10)
        $pointsToAward = (int)floor($amount * 10);
        
        // Get user_id from the order
        $userStmt = $pdo->prepare('SELECT user_id FROM orders WHERE id = ?');
        $userStmt->execute([$orderId]);
        $userId = $userStmt->fetchColumn();
        
        if ($userId) {
            // Lock user row to prevent race conditions with concurrent point updates
            $lockStmt = $pdo->prepare("SELECT loyalty_points FROM users WHERE id = ? FOR UPDATE");
            $lockStmt->execute([$userId]);
            
            // Award loyalty points
            $pdo->prepare('UPDATE users SET loyalty_points = loyalty_points + ? WHERE id = ?')
                ->execute([$pointsToAward, $userId]);
            
            $note .= " (Store Credit: {$pointsToAward} loyalty points awarded)";
        }
        
        $status = 'processed';
    }

    // 5. Persist the refund record
    $insStmt = $pdo->prepare('
        INSERT INTO refunds (order_id, return_id, amount, method, gateway_ref, status, approved_by, note, processed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ');
    $insStmt->execute([$orderId, $primaryReturnId, $amount, $method, $gatewayRef, $status, $staffId, $note ?: null]);
    $refundId = $pdo->lastInsertId();

    $pdo->commit();

    logger('ok', 'REFUND', "Refund #{$refundId} of GHS {$amount} via {$method} on ORD-{$orderId} by {$staff['name']}");

    echo json_encode([
        'success'     => true,
        'message'     => 'Refund processed successfully.',
        'refund_id'   => (int)$refundId,
        'amount'      => $amount,
        'method'      => $method,
        'gateway_ref' => $gatewayRef,
        'status'      => $status,
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
