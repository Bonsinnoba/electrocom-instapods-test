<?php
/**
 * Manage missing-item reports raised during picking.
 */
require_once 'db.php';
require_once 'security.php';
require_once 'notifications.php';

header('Content-Type: application/json');

try {
    $userId = authenticate($pdo);
    requireRole(['super', 'store_manager', 'picker', 'accountant'], $pdo);
    $role = getUserRole($userId, $pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$pdo->exec("CREATE TABLE IF NOT EXISTS order_missing_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT DEFAULT NULL,
    product_name VARCHAR(255) NOT NULL,
    qty_missing INT NOT NULL DEFAULT 1,
    reason VARCHAR(255) DEFAULT NULL,
    reported_by INT NOT NULL,
    status ENUM('open', 'resolved') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME DEFAULT NULL,
    resolved_by INT DEFAULT NULL,
    resolution_note VARCHAR(255) DEFAULT NULL,
    customer_action ENUM('replace_item','refund_item','cancel_order','accept_available') DEFAULT NULL,
    customer_notified_at DATETIME DEFAULT NULL,
    INDEX idx_order_created (order_id, created_at),
    INDEX idx_status_created (status, created_at)
)");

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
    $cols = $pdo->query("DESCRIBE order_missing_items")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('resolved_at', $cols, true)) {
        $pdo->exec("ALTER TABLE order_missing_items ADD COLUMN resolved_at DATETIME DEFAULT NULL");
    }
    if (!in_array('resolved_by', $cols, true)) {
        $pdo->exec("ALTER TABLE order_missing_items ADD COLUMN resolved_by INT DEFAULT NULL");
    }
    if (!in_array('resolution_note', $cols, true)) {
        $pdo->exec("ALTER TABLE order_missing_items ADD COLUMN resolution_note VARCHAR(255) DEFAULT NULL");
    }
    if (!in_array('customer_action', $cols, true)) {
        $pdo->exec("ALTER TABLE order_missing_items ADD COLUMN customer_action ENUM('replace_item','refund_item','cancel_order','accept_available') DEFAULT NULL");
    }
    if (!in_array('customer_notified_at', $cols, true)) {
        $pdo->exec("ALTER TABLE order_missing_items ADD COLUMN customer_notified_at DATETIME DEFAULT NULL");
    }
    $pdo->exec("ALTER TABLE order_missing_items MODIFY COLUMN customer_action ENUM('replace_item','refund_item','cancel_order','accept_available') DEFAULT NULL");
} catch (Throwable $e) {
    // Non-fatal hardening path
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $status = trim((string)($_GET['status'] ?? 'open'));
    $limit = max(1, min(500, (int)($_GET['limit'] ?? 100)));
    if (!in_array($status, ['open', 'resolved', 'all'], true)) {
        $status = 'open';
    }

    try {
        $where = $status === 'all' ? '' : 'WHERE mi.status = ?';
        $sql = "
            SELECT
                mi.id,
                mi.order_id,
                mi.product_id,
                mi.product_name,
                mi.qty_missing,
                mi.reason,
                mi.status,
                mi.created_at,
                mi.resolved_at,
                mi.resolution_note,
                mi.customer_action,
                mi.customer_notified_at,
                u.name AS reported_by_name,
                ru.name AS resolved_by_name
            FROM order_missing_items mi
            LEFT JOIN users u ON mi.reported_by = u.id
            LEFT JOIN users ru ON mi.resolved_by = ru.id
            {$where}
            ORDER BY mi.id DESC
            LIMIT " . (int)$limit;

        $stmt = $pdo->prepare($sql);
        if ($status === 'all') {
            $stmt->execute();
        } else {
            $stmt->execute([$status]);
        }
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $agg = $pdo->query("
            SELECT
                SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_count,
                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_count
            FROM order_missing_items
        ")->fetch(PDO::FETCH_ASSOC) ?: ['open_count' => 0, 'resolved_count' => 0];

        echo json_encode([
            'success' => true,
            'data' => $rows,
            'summary' => [
                'open' => (int)($agg['open_count'] ?? 0),
                'resolved' => (int)($agg['resolved_count'] ?? 0),
            ],
        ]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to load missing-item reports']);
    }
    exit;
}

if ($method === 'POST') {
    if (!in_array($role, ['super', 'store_manager'], true)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Only store managers can resolve reports']);
        exit;
    }

    $raw = trim(file_get_contents('php://input'));
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
        exit;
    }
    $action = trim((string)($decoded['action'] ?? ''));
    $id = (int)($decoded['id'] ?? 0);
    $note = sanitizeInput($decoded['note'] ?? '');

    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Valid report id is required']);
        exit;
    }

    try {
        if ($action === 'resolve') {
            $stmt = $pdo->prepare("
                UPDATE order_missing_items
                SET status = 'resolved', resolved_at = UTC_TIMESTAMP(), resolved_by = ?, resolution_note = ?
                WHERE id = ?
            ");
            $stmt->execute([$userId, $note ?: null, $id]);
            echo json_encode(['success' => true, 'updated' => (int)$stmt->rowCount()]);
            exit;
        }
        if ($action === 'customer_resolution') {
            $resolution = trim((string)($decoded['resolution'] ?? ''));
            $allowed = ['replace_item', 'refund_item', 'cancel_order', 'accept_available'];
            if (!in_array($resolution, $allowed, true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid resolution']);
                exit;
            }

            $pdo->beginTransaction();

            $getIdStmt = $pdo->prepare("SELECT order_id FROM order_missing_items WHERE id = ?");
            $getIdStmt->execute([$id]);
            $orderId = (int)$getIdStmt->fetchColumn();
            if (!$orderId) {
                throw new Exception('Report not found');
            }

            $orderStmt = $pdo->prepare("SELECT id, user_id, status FROM orders WHERE id = ? FOR UPDATE");
            $orderStmt->execute([$orderId]);
            $order = $orderStmt->fetch(PDO::FETCH_ASSOC);
            if (!$order) {
                throw new Exception('Order not found');
            }

            $reportStmt = $pdo->prepare("SELECT * FROM order_missing_items WHERE id = ? FOR UPDATE");
            $reportStmt->execute([$id]);
            $report = $reportStmt->fetch(PDO::FETCH_ASSOC);
            if (!$report) {
                throw new Exception('Report not found');
            }

            $orderRef = 'ORD-' . $orderId;
            $message = '';
            if ($resolution === 'replace_item') {
                $message = "We could not find one item in {$orderRef}. Please reply with your preferred replacement option.";
            } elseif ($resolution === 'refund_item') {
                $message = "One item in {$orderRef} is unavailable. We will process a refund for that item and continue the remaining items.";
            } elseif ($resolution === 'accept_available') {
                $message = "One item in {$orderRef} is partially available. We will proceed with available quantity and refund the missing quantity.";
            } else {
                $message = "One item in {$orderRef} is unavailable. Your order will be cancelled and a refund will be processed.";
            }

            if ($resolution === 'cancel_order') {
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
                UPDATE order_missing_items
                SET
                    status = 'resolved',
                    resolved_at = UTC_TIMESTAMP(),
                    resolved_by = ?,
                    resolution_note = ?,
                    customer_action = ?,
                    customer_notified_at = UTC_TIMESTAMP()
                WHERE id = ?
            ")->execute([$userId, $note ?: null, $resolution, $id]);

            $pdo->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Order Update', ?, 'order')")
                ->execute([(int)$order['user_id'], $message]);

            $adminLog = "Missing item case {$id} resolved as {$resolution} for {$orderRef} by " . getUserName($userId, $pdo);
            $pdo->prepare("INSERT INTO order_status_logs (order_id, status_key, message) VALUES (?, ?, ?)")
                ->execute([$orderId, 'processing', $adminLog]);
            logger('info', 'MISSING_ITEMS', $adminLog);

            $pdo->commit();
            echo json_encode(['success' => true, 'updated' => 1]);
            exit;
        }
        if ($action === 'request_customer_confirmation') {
            $pdo->beginTransaction();

            $getIdStmt = $pdo->prepare("SELECT order_id FROM order_missing_items WHERE id = ?");
            $getIdStmt->execute([$id]);
            $orderId = (int)$getIdStmt->fetchColumn();
            if (!$orderId) {
                throw new Exception('Report not found');
            }

            $orderStmt = $pdo->prepare("SELECT id, user_id FROM orders WHERE id = ? FOR UPDATE");
            $orderStmt->execute([$orderId]);
            $order = $orderStmt->fetch(PDO::FETCH_ASSOC);
            if (!$order) {
                throw new Exception('Order not found');
            }

            $reportStmt = $pdo->prepare("SELECT * FROM order_missing_items WHERE id = ? FOR UPDATE");
            $reportStmt->execute([$id]);
            $report = $reportStmt->fetch(PDO::FETCH_ASSOC);
            if (!$report) {
                throw new Exception('Report not found');
            }

            $userStmt = $pdo->prepare("SELECT email, phone, name FROM users WHERE id = ?");
            $userStmt->execute([(int)$order['user_id']]);
            $cust = $userStmt->fetch(PDO::FETCH_ASSOC) ?: ['email' => '', 'phone' => '', 'name' => 'Customer'];

            $ins = $pdo->prepare("
                INSERT INTO missing_item_confirmations (report_id, order_id, user_id, proposed_options, status)
                VALUES (?, ?, ?, ?, 'pending')
            ");
            $opts = json_encode(['replace_item', 'refund_item', 'cancel_order', 'accept_available']);
            $ins->execute([$id, $orderId, (int)$order['user_id'], $opts]);

            $orderRef = 'ORD-' . $orderId;
            $message = "Action required: An item in {$orderRef} is unavailable. Open your app notifications to choose replacement, item refund, continue with available quantity, or cancel order.";

            $pdo->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Order Action Required', ?, 'order')")
                ->execute([(int)$order['user_id'], $message]);

            $notifier = new NotificationService();
            if (!empty($cust['email'])) {
                $notifier->queueNotification('email', $cust['email'], $message, "Action required for {$orderRef}");
            }
            if (!empty($cust['phone'])) {
                $notifier->queueNotification('sms', $cust['phone'], $message);
            }

            $adminLog = "Missing item case {$id} requested customer confirmation for {$orderRef} by " . getUserName($userId, $pdo);
            $pdo->prepare("INSERT INTO order_status_logs (order_id, status_key, message) VALUES (?, ?, ?)")
                ->execute([$orderId, 'processing', $adminLog]);
            logger('info', 'MISSING_ITEMS', $adminLog);

            $pdo->commit();
            echo json_encode(['success' => true, 'requested' => 1]);
            exit;
        }
        if ($action === 'reopen') {
            $stmt = $pdo->prepare("
                UPDATE order_missing_items
                SET status = 'open', resolved_at = NULL, resolved_by = NULL, resolution_note = NULL
                WHERE id = ?
            ");
            $stmt->execute([$id]);
            echo json_encode(['success' => true, 'updated' => (int)$stmt->rowCount()]);
            exit;
        }
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Action failed']);
        exit;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Unknown action']);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
