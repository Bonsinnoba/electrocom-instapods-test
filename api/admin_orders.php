<?php
require 'cors_middleware.php';
require 'db.php';
require 'security.php';

require_once 'inventory_utils.php';

// Lazy-sync pending orders to cancelled if they expired
lazyCancelOrders($pdo);

header('Content-Type: application/json');

// Authenticate User
try {
    $userId = authenticate();
    $role = getUserRole($userId, $pdo);
    $userName = getUserName($userId, $pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

// Granular Role Access
if ($method === 'GET') {
    // Audit access: Store Managers, Accountants, Super
    requireRole(RBAC_ALL_ADMINS, $pdo);
} elseif ($method === 'POST') {
    // Fulfillment access: Store Managers and Pickers
    requireRole(['super', 'store_manager', 'picker'], $pdo);
}

if ($method === 'GET') {
    try {
        $filterSql = "";
        $params = [];
        
        $search = mb_substr(trim($_GET['search'] ?? ''), 0, 100);
        if ($search !== '') {
            $searchStr = str_ireplace('ORD-', '', $search);
            if (is_numeric($searchStr)) {
                $filterSql = "WHERE o.id = ?";
                $params = [(int)$searchStr];
            } else {
                $filterSql = "WHERE u.name LIKE ? OR u.email LIKE ?";
                $s = "%$search%";
                $params = [$s, $s];
            }
        }
        
        $orderCols = $pdo->query("DESCRIBE orders")->fetchAll(PDO::FETCH_COLUMN);
        $hasDeliveryMethod = in_array('delivery_method', $orderCols, true);
        $deliverySelect = $hasDeliveryMethod ? "o.delivery_method" : "'pickup'";

        $stmt = $pdo->prepare("
            SELECT 
                o.id, 
                o.total_amount as amount, 
                o.status, 
                {$deliverySelect} as delivery_method,
                o.created_at as date,
                u.name as customer,
                u.email,
                u.region as user_region,
                o.shipping_address as address,
                CASE
                    WHEN o.delivery_method = 'pickup' THEN 'Pick Up'
                    ELSE 'Delivery'
                END as type
            FROM orders o
            JOIN users u ON o.user_id = u.id
            $filterSql
            ORDER BY o.created_at DESC
        ");
        $stmt->execute($params);
        $orders = $stmt->fetchAll();

        if (!empty($orders)) {
            $orderIds = array_column($orders, 'id');
            $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
            
            $itemStmt = $pdo->prepare("
                SELECT
                    oi.order_id,
                    oi.product_id,
                    p.name,
                    p.product_code,
                    p.location,
                    p.aisle,
                    p.rack,
                    p.bin,
                    oi.quantity as qty,
                    oi.price_at_purchase as price
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id IN ($placeholders)
            ");
            $itemStmt->execute($orderIds);
            $allItems = $itemStmt->fetchAll(PDO::FETCH_GROUP | PDO::FETCH_ASSOC);

            foreach ($orders as &$order) {
                $order['items'] = $allItems[$order['id']] ?? [];
                $order['id'] = 'ORD-' . $order['id']; // Add prefix for display
            }
        }

        sendResponse(true, 'Orders fetched successfully', $orders);
    } catch (PDOException $e) {
        sendResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
} elseif ($method === 'POST') {
    $content = trim(file_get_contents("php://input"));
    $decoded = json_decode($content, true);
    $action = $decoded['action'] ?? '';

    if ($action === 'update_status') {
        if ($role === 'picker') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Picker role must use picker workflow actions.']);
            exit;
        }

        $idStr = $decoded['id'] ?? null;
        $status = $decoded['status'] ?? 'pending';

        // Allowlist validation — prevent invalid enum values from corrupting order state
        $allowedStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
        if (!in_array($status, $allowedStatuses, true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid status value.']);
            exit;
        }

        if (!$idStr) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Order ID is required']);
            exit;
        }

        $id = str_replace('ORD-', '', $idStr);

        try {
            $pdo->beginTransaction();

            $currStmt = $pdo->prepare("SELECT status FROM orders WHERE id = ? FOR UPDATE");
            $currStmt->execute([$id]);
            $currentStatus = $currStmt->fetchColumn();

            if (!$currentStatus) {
                throw new Exception("Order not found.");
            }

            if ($currentStatus !== $status) {
                $stmt = $pdo->prepare("UPDATE orders SET status = ? WHERE id = ?");
                $stmt->execute([$status, $id]);

                // Stock Replenishment Logic
                $deductedStatuses = ['processing', 'shipped', 'delivered'];
                $restoredStatuses = ['cancelled', 'returned'];
                
                if (in_array($currentStatus, $deductedStatuses) && in_array($status, $restoredStatuses)) {
                    $itemStmt = $pdo->prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?");
                    $itemStmt->execute([$id]);
                    $items = $itemStmt->fetchAll();
                    
                    $restoreStmt = $pdo->prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?");
                    foreach ($items as $item) {
                        $restoreStmt->execute([$item['quantity'], $item['product_id']]);
                    }
                }
            }

            // Notify User of status change
            $userStmt = $pdo->prepare("SELECT user_id FROM orders WHERE id = ?");
            $userStmt->execute([$id]);
            $order = $userStmt->fetch();
            if ($order) {
                $statusMsg = "Your order ORD-{$id} has been updated to " . ucfirst($status) . ".";
                $pdo->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Order Update', ?, 'order')")
                    ->execute([$order['user_id'], $statusMsg]);
            }

            logger('info', 'ORDERS', "Order {$idStr} status updated to " . strtoupper($status) . " by {$userName}");

            // Recalculate level if delivered
            if ($status === 'delivered') {
                updateUserLevel($order['user_id'], $pdo);
            }

            $pdo->commit();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    } elseif ($action === 'picker_update') {
        if ($role !== 'picker' && $role !== 'super' && $role !== 'store_manager') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Forbidden']);
            exit;
        }

        $idStr = $decoded['id'] ?? null;
        $stage = strtolower(trim((string)($decoded['stage'] ?? '')));

        if (!$idStr || !$stage) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Order ID and stage are required']);
            exit;
        }

        $allowedStages = ['received', 'picked', 'dispatched'];
        if (!in_array($stage, $allowedStages, true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid picker stage']);
            exit;
        }

        $id = str_replace('ORD-', '', $idStr);

        try {
            $pdo->beginTransaction();

            $currStmt = $pdo->prepare("SELECT status, user_id FROM orders WHERE id = ? FOR UPDATE");
            $currStmt->execute([$id]);
            $order = $currStmt->fetch(PDO::FETCH_ASSOC);

            if (!$order) {
                throw new Exception('Order not found');
            }

            $statusMap = [
                'received' => 'processing',
                'picked' => 'processing',
                'dispatched' => 'shipped'
            ];

            $logMessageMap = [
                'received' => "Order {$idStr} received by picker {$userName}.",
                'picked' => "Items for {$idStr} picked and packed by {$userName}.",
                'dispatched' => "Order {$idStr} dispatched from store by {$userName}."
            ];

            $newStatus = $statusMap[$stage];
            if ($order['status'] !== $newStatus) {
                $upd = $pdo->prepare("UPDATE orders SET status = ? WHERE id = ?");
                $upd->execute([$newStatus, $id]);
            }

            $pdo->prepare("INSERT INTO order_status_logs (order_id, status_key, message) VALUES (?, ?, ?)")
                ->execute([$id, $stage === 'dispatched' ? 'shipped' : $stage, $logMessageMap[$stage]]);

            $userMsgMap = [
                'received' => "Your order {$idStr} has been received for picking.",
                'picked' => "Good news! Items for your order {$idStr} have been picked.",
                'dispatched' => "Your order {$idStr} has been dispatched and is on the way."
            ];

            $pdo->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Order Update', ?, 'order')")
                ->execute([$order['user_id'], $userMsgMap[$stage]]);

            logger('info', 'PICKER', "Picker workflow update for {$idStr}: {$stage} by {$userName}");
            $pdo->commit();

            echo json_encode(['success' => true, 'status' => $newStatus, 'stage' => $stage]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    } elseif ($action === 'picker_report_missing') {
        if (!in_array($role, ['picker', 'super', 'store_manager'], true)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Forbidden']);
            exit;
        }

        $idStr = $decoded['id'] ?? null;
        $items = $decoded['items'] ?? [];
        if (!$idStr || !is_array($items) || empty($items)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Order ID and missing items are required']);
            exit;
        }

        $id = (int)str_replace('ORD-', '', (string)$idStr);
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid order ID']);
            exit;
        }

        try {
            $pdo->beginTransaction();

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
                INDEX idx_order_created (order_id, created_at),
                INDEX idx_status_created (status, created_at)
            )");

            $orderStmt = $pdo->prepare("SELECT user_id FROM orders WHERE id = ? FOR UPDATE");
            $orderStmt->execute([$id]);
            $order = $orderStmt->fetch(PDO::FETCH_ASSOC);
            if (!$order) {
                throw new Exception('Order not found');
            }

            $ins = $pdo->prepare("
                INSERT INTO order_missing_items (order_id, product_id, product_name, qty_missing, reason, reported_by)
                VALUES (?, ?, ?, ?, ?, ?)
            ");

            $reported = 0;
            $summaryParts = [];
            foreach ($items as $it) {
                $name = sanitizeInput($it['name'] ?? '');
                $reason = sanitizeInput($it['reason'] ?? '');
                $qty = max(1, (int)($it['qty'] ?? 1));
                $productId = isset($it['product_id']) ? (int)$it['product_id'] : null;
                if ($name === '') {
                    continue;
                }
                $ins->execute([$id, $productId ?: null, $name, $qty, $reason ?: null, $userId]);
                $summaryParts[] = "{$name} (x{$qty})";
                $reported++;
            }

            if ($reported === 0) {
                throw new Exception('No valid missing items supplied');
            }

            $orderRef = 'ORD-' . $id;
            $summary = implode(', ', array_slice($summaryParts, 0, 5));
            if (count($summaryParts) > 5) {
                $summary .= ', ...';
            }
            $logMessage = "Picker {$userName} reported missing item(s) for {$orderRef}: {$summary}";
            $pdo->prepare("INSERT INTO order_status_logs (order_id, status_key, message) VALUES (?, 'processing', ?)")
                ->execute([$id, $logMessage]);

            // Notify privileged staff
            $staffStmt = $pdo->query("SELECT id FROM users WHERE role IN ('super', 'admin', 'store_manager') AND status = 'active'");
            $staffIds = $staffStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
            if (!empty($staffIds)) {
                $notif = $pdo->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Missing Item Alert', ?, 'warning')");
                foreach ($staffIds as $sid) {
                    $notif->execute([(int)$sid, $logMessage]);
                }
            }

            // Notify customer that substitution/contact may follow
            $userMsg = "We're reviewing item availability for {$orderRef}. Our team may contact you with substitution options.";
            $pdo->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Order Update', ?, 'order')")
                ->execute([(int)$order['user_id'], $userMsg]);

            logger('warn', 'PICKER', $logMessage);
            $pdo->commit();
            echo json_encode(['success' => true, 'reported' => $reported]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    } elseif ($action === 'resend_receipt') {
        if ($role === 'picker') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Picker role cannot resend receipts']);
            exit;
        }

        $idStr = $decoded['id'] ?? null;
        if (!$idStr) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Order ID is required']);
            exit;
        }
        $id = str_replace('ORD-', '', $idStr);

        try {
            $stmt = $pdo->prepare("
                SELECT o.*, u.email, u.name 
                FROM orders o 
                JOIN users u ON o.user_id = u.id 
                WHERE o.id = ?
            ");
            $stmt->execute([$id]);
            $order = $stmt->fetch();

            if (!$order) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Order not found']);
                exit;
            }

            $itemStmt = $pdo->prepare("SELECT p.name, oi.quantity as qty, oi.price_at_purchase as price FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?");
            $itemStmt->execute([$id]);
            $items = $itemStmt->fetchAll();

            require_once 'notifications.php';
            require_once __DIR__ . '/brand_settings.php';
            $notifier = new NotificationService();
            $bn = eh_brand_site_name();

            $subject = "Receipt for Order #{$idStr}";
            $itemsList = "";
            foreach ($items as $item) {
                $itemsList .= "- {$item['name']} x {$item['qty']} (GHS " . number_format($item['price'], 2) . ")\n";
            }

            $msg = "Hello {$order['name']},\n\nHere is your receipt for order #{$idStr}.\n\nItems:\n{$itemsList}\nTotal: GHS " . number_format($order['total_amount'], 2) . "\n\nThank you for shopping with {$bn}!";

            $notifier->queueNotification('email', $order['email'], $msg, $subject);

            logger('info', 'ORDERS', "Receipt for order {$idStr} manually re-sent by {$userName}");
            echo json_encode(['success' => true, 'message' => 'Receipt re-sent successfully']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    } elseif ($action === 'verify_delivery') {
        if ($role === 'picker') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Picker role cannot verify delivery']);
            exit;
        }

        $idStr = $decoded['id'] ?? null;
        $otp = $decoded['otp'] ?? '';

        if (!$idStr || !$otp) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Order ID and Delivery Code are required']);
            exit;
        }

        $id = str_replace('ORD-', '', $idStr);

        try {
            $stmt = $pdo->prepare("SELECT delivery_otp, status FROM orders WHERE id = ?");
            $stmt->execute([$id]);
            $order = $stmt->fetch();

            if (!$order) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Order not found']);
                exit;
            }

            if ($order['status'] === 'delivered') {
                echo json_encode(['success' => false, 'error' => 'This order has already been delivered']);
                exit;
            }

            if (!hash_equals((string)$order['delivery_otp'], (string)$otp)) {
                echo json_encode(['success' => false, 'error' => 'Invalid Delivery Code. Please check with the customer.']);
                exit;
            }

            $updateStmt = $pdo->prepare("UPDATE orders SET status = 'delivered' WHERE id = ?");
            $updateStmt->execute([$id]);

            $userStmt = $pdo->prepare("SELECT user_id FROM orders WHERE id = ?");
            $userStmt->execute([$id]);
            $order = $userStmt->fetch();
            if ($order) {
                updateUserLevel($order['user_id'], $pdo);
            }

            logger('ok', 'ORDERS', "Order {$idStr} verified and DELIVERED via OTP by {$userName}");

            echo json_encode(['success' => true, 'message' => 'Delivery verified successfully! Order marked as Delivered.']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
