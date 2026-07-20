<?php
/**
 * Customer-facing missing-item confirmation actions.
 */
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

try {
    $userId = authenticate($pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$pdo->exec("CREATE TABLE IF NOT EXISTS missing_item_confirmations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_id BIGINT NOT NULL,
    order_id INT NOT NULL,
    user_id INT NOT NULL,
    proposed_options JSON NOT NULL,
    status ENUM('pending','confirmed','expired') DEFAULT 'pending',
    customer_choice ENUM('replace_item','refund_item','cancel_order','accept_available') DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME DEFAULT NULL,
    INDEX idx_user_status_created (user_id, status, created_at),
    INDEX idx_report (report_id)
)");
try {
    $pdo->exec("ALTER TABLE missing_item_confirmations MODIFY COLUMN customer_choice ENUM('replace_item','refund_item','cancel_order','accept_available') DEFAULT NULL");
} catch (Throwable $e) {
    // best effort
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    try {
        $stmt = $pdo->prepare("
            SELECT
                c.id,
                c.order_id,
                c.report_id,
                c.proposed_options,
                c.status,
                c.created_at,
                mi.product_name,
                mi.qty_missing
            FROM missing_item_confirmations c
            JOIN order_missing_items mi ON c.report_id = mi.id
            WHERE c.user_id = ? AND c.status = 'pending'
            ORDER BY c.id DESC
            LIMIT 20
        ");
        $stmt->execute([$userId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$r) {
            $opts = json_decode((string)$r['proposed_options'], true);
            $r['proposed_options'] = is_array($opts) ? $opts : [];
        }
        echo json_encode(['success' => true, 'data' => $rows]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to load confirmations']);
    }
    exit;
}

if ($method === 'POST') {
    $raw = trim(file_get_contents('php://input'));
    $decoded = json_decode($raw, true);
    $id = (int)($decoded['id'] ?? 0);
    $choice = trim((string)($decoded['choice'] ?? ''));
    if ($id <= 0 || !in_array($choice, ['replace_item', 'refund_item', 'cancel_order', 'accept_available'], true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid confirmation payload']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("SELECT * FROM missing_item_confirmations WHERE id = ? AND user_id = ? FOR UPDATE");
        $stmt->execute([$id, $userId]);
        $conf = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$conf || $conf['status'] !== 'pending') {
            throw new Exception('Confirmation is no longer pending');
        }

        $opts = json_decode((string)$conf['proposed_options'], true);
        if (!is_array($opts) || !in_array($choice, $opts, true)) {
            throw new Exception('Selected option is not allowed');
        }

        $orderId = (int)$conf['order_id'];
        $orderStmt = $pdo->prepare("SELECT * FROM orders WHERE id = ? FOR UPDATE");
        $orderStmt->execute([$orderId]);
        $order = $orderStmt->fetch(PDO::FETCH_ASSOC);
        if (!$order) {
            throw new Exception('Order not found');
        }

        $reportStmt = $pdo->prepare("SELECT * FROM order_missing_items WHERE id = ? FOR UPDATE");
        $reportStmt->execute([(int)$conf['report_id']]);
        $report = $reportStmt->fetch(PDO::FETCH_ASSOC);
        if (!$report) {
            throw new Exception('Related report not found');
        }

        if ($choice === 'accept_available') {
            $productId = isset($report['product_id']) ? (int)$report['product_id'] : 0;
            $qtyMissing = max(1, (int)($report['qty_missing'] ?? 1));
            if ($productId <= 0) {
                throw new Exception('Cannot apply partial quantity without product mapping');
            }

            $oiStmt = $pdo->prepare("SELECT quantity, price_at_purchase FROM order_items WHERE order_id = ? AND product_id = ? LIMIT 1");
            $oiStmt->execute([$orderId, $productId]);
            $oi = $oiStmt->fetch(PDO::FETCH_ASSOC);
            if (!$oi) {
                throw new Exception('Order item for missing product not found');
            }

            $oldQty = (int)$oi['quantity'];
            $newQty = max(0, $oldQty - $qtyMissing);
            $unitPrice = (float)$oi['price_at_purchase'];
            $deduction = $unitPrice * min($qtyMissing, $oldQty);

            if ($newQty <= 0) {
                $pdo->prepare("DELETE FROM order_items WHERE order_id = ? AND product_id = ?")->execute([$orderId, $productId]);
            } else {
                $pdo->prepare("UPDATE order_items SET quantity = ? WHERE order_id = ? AND product_id = ?")
                    ->execute([$newQty, $orderId, $productId]);
            }

            $pdo->prepare("UPDATE orders SET total_amount = GREATEST(0, total_amount - ?) WHERE id = ?")
                ->execute([$deduction, $orderId]);
        } elseif ($choice === 'cancel_order') {
            $currentStatus = strtolower((string)($order['status'] ?? 'pending'));
            if ($currentStatus !== 'cancelled') {
                $pdo->prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?")->execute([$orderId]);
                $deductedStatuses = ['processing', 'shipped', 'delivered'];
                if (in_array($currentStatus, $deductedStatuses, true)) {
                    $itemStmt = $pdo->prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?");
                    $itemStmt->execute([$orderId]);
                    $items = $itemStmt->fetchAll(PDO::FETCH_ASSOC);
                    $restoreStmt = $pdo->prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?");
                    foreach ($items as $item) {
                        $restoreStmt->execute([(int)$item['quantity'], (int)$item['product_id']]);
                    }
                }
            }
        }

        $pdo->prepare("
            UPDATE missing_item_confirmations
            SET status = 'confirmed', customer_choice = ?, confirmed_at = UTC_TIMESTAMP()
            WHERE id = ?
        ")->execute([$choice, $id]);

        $pdo->prepare("
            UPDATE order_missing_items
            SET status = 'resolved',
                customer_action = ?,
                customer_notified_at = COALESCE(customer_notified_at, UTC_TIMESTAMP()),
                resolved_at = UTC_TIMESTAMP(),
                resolved_by = NULL,
                resolution_note = COALESCE(resolution_note, 'Customer confirmed in app')
            WHERE id = ?
        ")->execute([$choice, (int)$conf['report_id']]);

        $choiceLabel = str_replace('_', ' ', $choice);
        $orderRef = 'ORD-' . $orderId;
        $logMsg = "Customer confirmed '{$choiceLabel}' for missing-item case {$conf['report_id']} on {$orderRef}.";
        $pdo->prepare("INSERT INTO order_status_logs (order_id, status_key, message) VALUES (?, 'processing', ?)")
            ->execute([$orderId, $logMsg]);

        $staffStmt = $pdo->query("SELECT id FROM users WHERE role IN ('super','store_manager') AND status = 'active'");
        $staffIds = $staffStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
        if (!empty($staffIds)) {
            $notif = $pdo->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Missing Item Customer Decision', ?, 'info')");
            foreach ($staffIds as $sid) {
                $notif->execute([(int)$sid, $logMsg]);
            }
        }

        logger('info', 'MISSING_ITEMS', $logMsg);
        $pdo->commit();
        echo json_encode(['success' => true]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
