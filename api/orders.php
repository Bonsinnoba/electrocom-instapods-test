<?php
// backend/orders.php
require_once 'db.php';
require_once 'security.php';
require_once 'order_utils.php';
require_once 'inventory_utils.php';
require_once __DIR__ . '/email/EmailEngine.php';
require_once __DIR__ . '/brand_settings.php';

// Lazy-cancel stale reservations at the start of every order operation
lazyCancelOrders($pdo);

header('Content-Type: application/json');

// --- Self-healing Schema ---
if ($config['DB_AUTO_REPAIR'] ?? false) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            total_amount DECIMAL(10, 2) NOT NULL,
            coupon_code VARCHAR(50) DEFAULT NULL,
            discount_amount DECIMAL(10, 2) DEFAULT 0.00,
            status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
            delivery_method ENUM('pickup', 'door_to_door') DEFAULT 'pickup',
            shipping_address TEXT,
            payment_method VARCHAR(50),
            payment_reference VARCHAR(100),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS order_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            product_id INT,
            quantity INT NOT NULL,
            price_at_purchase DECIMAL(10, 2) NOT NULL,
            selected_color VARCHAR(50),
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS order_idempotency (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            idempotency_key VARCHAR(120) NOT NULL,
            status ENUM('pending','completed') DEFAULT 'pending',
            order_id INT DEFAULT NULL,
            payment_reference VARCHAR(120) DEFAULT NULL,
            response_json JSON DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_user_key (user_id, idempotency_key),
            INDEX idx_status_created (status, created_at)
        )");

        $cols = $pdo->query("DESCRIBE orders")->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('order_number', $cols)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN order_number VARCHAR(100) UNIQUE AFTER id");
        }
        if (!in_array('coupon_code', $cols)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(50) AFTER total_amount");
        }
        if (!in_array('discount_amount', $cols)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10, 2) DEFAULT 0.00 AFTER coupon_code");
        }
        if (!in_array('review_requested_at', $cols)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN review_requested_at DATETIME DEFAULT NULL AFTER payment_reference");
        }
        if (!in_array('delivery_otp', $cols)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN delivery_otp VARCHAR(10) DEFAULT NULL AFTER status");
        }
        if (!in_array('cashier_id', $cols)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN cashier_id INT DEFAULT NULL AFTER user_id");
        }
        if (!in_array('delivery_method', $cols)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN delivery_method ENUM('pickup', 'door_to_door') DEFAULT 'pickup' AFTER status");
        }
        if (!in_array('pickup_location_id', $cols)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN pickup_location_id INT DEFAULT NULL AFTER delivery_method");
        }
        $pdo->exec("CREATE TABLE IF NOT EXISTS pickup_locations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            address TEXT NOT NULL,
            city VARCHAR(100) DEFAULT NULL,
            fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )");
    } catch (Exception $e) {
        error_log("Orders schema self-healing failed: " . $e->getMessage());
    }
}

// Authenticate User for all order operations
$authenticatedUserId = authenticate($pdo);
$authenticatedUserName = getUserName($authenticatedUserId, $pdo);
$authenticatedUserEmail = null;
try {
    $ueStmt = $pdo->prepare("SELECT email FROM users WHERE id = ?");
    $ueStmt->execute([$authenticatedUserId]);
    $authenticatedUserEmail = $ueStmt->fetchColumn() ?: null;
} catch (Throwable $e) {
    $authenticatedUserEmail = null;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // If a specific order ID is requested
    $orderIdStr = $_GET['order_id'] ?? null;

    if ($orderIdStr) {
        $id = str_replace('ORD-', '', $orderIdStr);
        try {
            $stmt = $pdo->prepare("
                SELECT id, total_amount, status, delivery_method, pickup_location_id, created_at, updated_at, shipping_address, payment_method, payment_reference
                FROM orders 
                WHERE id = ? AND user_id = ?
            ");
            $stmt->execute([$id, $authenticatedUserId]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$order) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Order not found']);
                exit;
            }

            // Get items
            $itemStmt = $pdo->prepare("
                SELECT p.name, oi.quantity as qty, oi.price_at_purchase as price, p.image_url
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = ?
            ");
            $itemStmt->execute([$id]);
            $order['items'] = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

            // Get tracking logs
            $logStmt = $pdo->prepare("
                SELECT status_key, message, created_at
                FROM order_status_logs
                WHERE order_id = ?
                ORDER BY created_at ASC
            ");
            $logStmt->execute([$id]);
            $order['logs'] = $logStmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'data' => $order]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to fetch order details']);
        }
        exit;
    }

    // Otherwise, fetch all orders for the user with pagination
    try {
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = max(10, min(50, (int)($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        // Get total count for pagination metadata
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM orders WHERE user_id = ?");
        $countStmt->execute([$authenticatedUserId]);
        $totalOrders = (int)$countStmt->fetchColumn();
        $totalPages = ceil($totalOrders / $limit);

        $stmt = $pdo->prepare("
            SELECT 
                o.id, o.total_amount, o.status, o.delivery_method, o.pickup_location_id, o.created_at,
                GROUP_CONCAT(p.name SEPARATOR ', ') as items,
                COALESCE(SUM(r.amount), 0) as refunded_amount,
                MAX(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) as has_pending_refund
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id
            LEFT JOIN refunds r ON o.id = r.order_id AND r.status != 'failed'
            WHERE o.user_id = ?
            GROUP BY o.id
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute([$authenticatedUserId, $limit, $offset]);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true, 
            'data' => $orders,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $totalOrders,
                'total_pages' => $totalPages,
                'has_next' => $page < $totalPages,
                'has_prev' => $page > 1
            ]
        ]);
    } catch (Exception $e) {
        error_log("Order fetch error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to fetch orders']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    // User-initiated order cancellation
    $orderIdStr = $_GET['order_id'] ?? null;
    if (!$orderIdStr) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Order ID is required']);
        exit;
    }

    $orderId = str_replace('ORD-', '', $orderIdStr);

    try {
        $pdo->beginTransaction();

        // Get order details
        $stmt = $pdo->prepare("SELECT id, user_id, status, payment_reference, total_amount FROM orders WHERE id = ? FOR UPDATE");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$order) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Order not found']);
            exit;
        }

        // Verify ownership
        if ($order['user_id'] != $authenticatedUserId) {
            $pdo->rollBack();
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'You can only cancel your own orders']);
            exit;
        }

        // Check if order can be cancelled (only pending or processing)
        if (!in_array($order['status'], ['pending', 'processing'])) {
            $pdo->rollBack();
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Order can only be cancelled while in pending or processing status']);
            exit;
        }

        // Update order status to cancelled
        $updateStmt = $pdo->prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?");
        $updateStmt->execute([$orderId]);

        // Log the cancellation
        $logStmt = $pdo->prepare("INSERT INTO order_status_logs (order_id, status_key, message) VALUES (?, 'cancelled', 'Order cancelled by user')");
        $logStmt->execute([$orderId]);

        // Restore stock quantities
        $itemStmt = $pdo->prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?");
        $itemStmt->execute([$orderId]);
        $items = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($items as $item) {
            $restoreStmt = $pdo->prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?");
            $restoreStmt->execute([$item['quantity'], $item['product_id']]);
        }

        // If payment was made, initiate refund
        if ($order['payment_reference'] && $order['status'] === 'processing') {
            // TODO: Integrate with Paystack refund API
            // For now, just log that a refund should be processed
            error_log("Refund needed for order {$orderId} with reference {$order['payment_reference']}");
        }

        $pdo->commit();

        echo json_encode(['success' => true, 'message' => 'Order cancelled successfully']);

    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log("Order cancellation error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to cancel order']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $content = trim(file_get_contents("php://input"));
    $decoded = json_decode($content, true);

    if (!is_array($decoded)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON payload']);
        exit;
    }

    // --- NEW: Proactive Hardening (Heartbeat & Cancellation) ---
    $action = $decoded['action'] ?? null;
    $orderRef = $decoded['reference'] ?? $decoded['payment_reference'] ?? null;

    if ($action === 'heartbeat' && $orderRef) {
        $stmt = $pdo->prepare("UPDATE orders SET last_activity_at = NOW() WHERE payment_reference = ? AND user_id = ? AND status = 'pending'");
        $stmt->execute([$orderRef, $authenticatedUserId]);
        echo json_encode(['success' => true, 'message' => 'Heartbeat updated']);
        exit;
    }

    if ($action === 'cancel' && $orderRef) {
        $stmt = $pdo->prepare("UPDATE orders SET status = 'cancelled' WHERE payment_reference = ? AND user_id = ? AND status = 'pending'");
        $stmt->execute([$orderRef, $authenticatedUserId]);
        if ($stmt->rowCount() > 0) {
            $getOid = $pdo->prepare("SELECT id FROM orders WHERE payment_reference = ? AND user_id = ?");
            $getOid->execute([$orderRef, $authenticatedUserId]);
            $orderId = $getOid->fetchColumn();
            if ($orderId) {
                $pdo->prepare("INSERT INTO order_status_logs (order_id, status_key, message) VALUES (?, 'cancelled', 'User abandoned checkout (Proactive Release)')")
                    ->execute([$orderId]);
            }
        }
        echo json_encode(['success' => true, 'message' => 'Reservation released']);
        exit;
    }
    // -----------------------------------------------------------

    $userId = $authenticatedUserId;
    $uStmt = $pdo->prepare("SELECT region FROM users WHERE id = ?");
    $uStmt->execute([$userId]);
    $userRegion = $uStmt->fetchColumn() ?: 'Greater Accra (GA)';

    $items = $decoded['items'] ?? [];
    usort($items, function($a, $b) {
        return (int)($a['id'] ?? 0) <=> (int)($b['id'] ?? 0);
    });
    $totalAmount = round((float)($decoded['total_amount'] ?? 0), 2);
    $shippingAddress = sanitizeInput($decoded['shipping_address'] ?? '');
    $paymentMethod = sanitizeInput($decoded['payment_method'] ?? 'card');
    $deliveryMethod = sanitizeInput($decoded['delivery_method'] ?? 'pickup');
    $pickupLocationId = isset($decoded['pickup_location_id']) ? (int)$decoded['pickup_location_id'] : null;
    $paymentReference = $decoded['payment_reference'] ?? null;
    $isExternalPayment = !empty($paymentReference);
    $idempotencyKey = sanitizeInput($decoded['idempotency_key'] ?? '');

    if (!in_array($deliveryMethod, ['pickup', 'door_to_door'], true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid delivery method']);
        exit;
    }
    if ($deliveryMethod === 'door_to_door') {
        $settings = eh_merged_super_settings();
        $allowDoorToDoor = !empty($settings['allowDoorToDoorDelivery']);
        if (!$allowDoorToDoor) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Door to door delivery is currently unavailable. Please choose pickup.']);
            exit;
        }
    }
    if ($deliveryMethod === 'pickup') {
        if (!$pickupLocationId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Pickup location is required.']);
            exit;
        }
        $pickupStmt = $pdo->prepare("SELECT name, address, city FROM pickup_locations WHERE id = ? AND is_active = 1");
        $pickupStmt->execute([$pickupLocationId]);
        $pickupLocation = $pickupStmt->fetch(PDO::FETCH_ASSOC);
        if (!$pickupLocation) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Selected pickup location is not available.']);
            exit;
        }
        $shippingAddress = trim(($pickupLocation['name'] ?? '') . ' - ' . ($pickupLocation['address'] ?? '') . (empty($pickupLocation['city']) ? '' : ', ' . $pickupLocation['city']));
    }

    if (!$paymentReference) {
        $hash = substr(md5(uniqid(mt_rand(), true)), 0, 8);
        $paymentReference = "EC-" . date('Y/m') . "-" . strtoupper($hash) . "-" . date('H');
    }
    $paymentReference = sanitizeInput($paymentReference);
    $couponCode = sanitizeInput($decoded['coupon_code'] ?? null);

    // --- ZERO-TRUST SERVER-SIDE CALCULATION ---
    $calculatedSubtotal = 0;
    foreach ($items as $itm) {
        $pId = (int)$itm['id'];
        $qty = (int)$itm['quantity'];
        $pPriceStmt = $pdo->prepare("SELECT price, discount_percent, sale_ends_at FROM products WHERE id = ?");
        $pPriceStmt->execute([$pId]);
        $priceData = $pPriceStmt->fetch(PDO::FETCH_ASSOC);
        if ($priceData) {
            $calculatedSubtotal += getEffectivePrice($priceData) * $qty;
        }
    }

    $calculatedDiscount = 0;
    $loyaltyPointsToDeduct = 0;

    if (!empty($couponCode)) {
        $couponStmt = $pdo->prepare("SELECT discount_amount FROM coupons WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW())");
        $couponStmt->execute([$couponCode]);
        $cVal = $couponStmt->fetchColumn();
        if ($cVal) {
            $calculatedDiscount += (float)$cVal;
        } else {
            $couponCode = null;
        }
    }

    $requestedDiscount = (float)($decoded['discount_amount'] ?? 0);
    $requestedLoyaltyDiscount = $requestedDiscount - $calculatedDiscount;
    $settings = eh_merged_super_settings();

    if ($requestedLoyaltyDiscount > 0) {
        $uStmt = $pdo->prepare("SELECT loyalty_points FROM users WHERE id = ?");
        $uStmt->execute([$userId]);
        $userPoints = (int)$uStmt->fetchColumn();
        
        $loyaltyThreshold = (float)($settings['integrityDiscountThreshold'] ?? 5000);
        $loyaltyPct = (float)($settings['integrityDiscountPct'] ?? 10);

        if ($userPoints >= $loyaltyThreshold && $loyaltyThreshold > 0 && $loyaltyPct > 0) {
            $maxLoyaltyDiscount = round($calculatedSubtotal * ($loyaltyPct / 100), 2);
            if (abs($requestedLoyaltyDiscount - $maxLoyaltyDiscount) <= 0.10) {
                 $calculatedDiscount += $maxLoyaltyDiscount;
                 // Deduct only the points equivalent to the discount applied, not the entire balance.
                 // Points earning rate: 1 point per GHS 1 spent. Deduction rate matches earning rate.
                 $loyaltyPointsToDeduct = (int)ceil($maxLoyaltyDiscount);
            }
        }
    }

    $taxableAmount = max(0, $calculatedSubtotal - $calculatedDiscount);
    $vatRate = (float)($settings['vatRate'] ?? 0);
    $tax = round($taxableAmount * ($vatRate / 100), 2);

    $calculatedTotal = round($taxableAmount + $tax, 2);
    $totalAmount = $calculatedTotal;
    $discountAmount = $calculatedDiscount;
    // ------------------------------------------

    if (empty($items) || $totalAmount <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing required fields']);
        exit;
    }

    $idempotencyRowId = null;
    if ($idempotencyKey !== '') {
        try {
            $idStmt = $pdo->prepare("SELECT id, status, order_id, payment_reference, response_json FROM order_idempotency WHERE user_id = ? AND idempotency_key = ? LIMIT 1");
            $idStmt->execute([$userId, $idempotencyKey]);
            $existing = $idStmt->fetch(PDO::FETCH_ASSOC);
            if ($existing) {
                if ($existing['status'] === 'completed' && !empty($existing['response_json'])) {
                    echo $existing['response_json'];
                    exit;
                }
                http_response_code(409);
                echo json_encode(['success' => false, 'message' => 'A checkout attempt with this token is already processing. Please wait a moment and retry.']);
                exit;
            }
            $insertIdStmt = $pdo->prepare("INSERT INTO order_idempotency (user_id, idempotency_key, status) VALUES (?, ?, 'pending')");
            $insertIdStmt->execute([$userId, $idempotencyKey]);
            $idempotencyRowId = (int)$pdo->lastInsertId();
        } catch (Throwable $idemErr) {
            // Fallback: continue without hard failure so checkout still works even if table is unavailable.
            $idempotencyRowId = null;
            error_log("Idempotency guard warning: " . $idemErr->getMessage());
        }
    }

    if ($isExternalPayment) {
        $secretKey = $config['PAYSTACK_SECRET'] ?? "";
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://api.paystack.co/transaction/verify/" . rawurlencode($paymentReference));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer " . $secretKey]);
        $result = curl_exec($ch);
        curl_close($ch);
        $response = json_decode($result, true);
        if (!$response || !isset($response['data']) || $response['data']['status'] !== 'success') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Payment verification failed']);
            exit;
        }
        
        // Ensure paid amount matches the calculated total
        $paidAmountGhs = $response['data']['amount'] / 100;
        if (abs($paidAmountGhs - $totalAmount) > 0.10) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => "Payment amount mismatch. Expected GHS {$totalAmount}, paid GHS {$paidAmountGhs}."]);
            exit;
        }
        $orderStatus = 'processing';
    } else {
        $orderStatus = 'pending';
    }

    $pdo->beginTransaction();
    try {
        $minPhysicalStockInCart = PHP_INT_MAX;
        foreach ($items as &$item) {
            $pId = (int)$item['id'];
            $qty = (int)$item['quantity'];
            $pQuery = $pdo->prepare("SELECT name, stock_quantity FROM products WHERE id = ? FOR UPDATE");
            $pQuery->execute([$pId]);
            $prod = $pQuery->fetch(PDO::FETCH_ASSOC);
            if (!$prod) throw new Exception("Product #{$pId} not found");

            $phys = (int)$prod['stock_quantity'];
            if ($phys < $minPhysicalStockInCart) {
                $minPhysicalStockInCart = $phys;
            }

            $available = getAvailableStock($pId, $pdo);
            if ($available < $qty) {
                throw new Exception("Insufficient stock for '{$prod['name']}'. Requested: {$qty}, Available: {$available}.");
            }
            
            // Re-verify price logic (simplified for restoration)
            $pPrice = $pdo->prepare("SELECT price, discount_percent, sale_ends_at FROM products WHERE id = ?");
            $pPrice->execute([$pId]);
            $priceData = $pPrice->fetch(PDO::FETCH_ASSOC);
            $item['price'] = getEffectivePrice($priceData);
        }
        unset($item);

        $deliveryOtp = sprintf("%06d", mt_rand(100000, 999999));
        $stmt = $pdo->prepare("INSERT INTO orders (user_id, total_amount, coupon_code, discount_amount, status, delivery_method, pickup_location_id, reserved_at, last_activity_at, delivery_otp, shipping_address, payment_method, payment_reference) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP(), ?, ?, ?, ?)");
        $stmt->execute([$userId, $totalAmount, $couponCode, $discountAmount, $orderStatus, $deliveryMethod, $pickupLocationId, $deliveryOtp, $shippingAddress, $paymentMethod, $paymentReference]);
        $orderId = $pdo->lastInsertId();
        
        $pdo->prepare("UPDATE orders SET order_number = ? WHERE id = ?")->execute([$paymentReference, $orderId]);

        $stmtItem = $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)");
        foreach ($items as $item) {
            $stmtItem->execute([$orderId, $item['id'], $item['quantity'], $item['price']]);
        }

        if ($orderStatus === 'processing') {
            completeOrder($orderId, $pdo);
        }

        // Deduct loyalty points if used
        if ($loyaltyPointsToDeduct > 0) {
            // Lock user row to prevent race conditions with concurrent point updates
            $lockStmt = $pdo->prepare("SELECT loyalty_points FROM users WHERE id = ? FOR UPDATE");
            $lockStmt->execute([$userId]);
            
            $deductStmt = $pdo->prepare("UPDATE users SET loyalty_points = loyalty_points - ? WHERE id = ?");
            $deductStmt->execute([$loyaltyPointsToDeduct, $userId]);
        }

        $pdo->commit();
        $reservationMinutes = ($minPhysicalStockInCart < 10) ? 5 : 20;
        $responsePayload = [
            'success' => true,
            'order_id' => $orderId,
            'payment_reference' => $paymentReference,
            'reservation_minutes' => $reservationMinutes,
            'reservation_expires_at' => gmdate('c', time() + $reservationMinutes * 60),
        ];
        if ($idempotencyRowId) {
            $respJson = json_encode($responsePayload);
            $doneStmt = $pdo->prepare("UPDATE order_idempotency SET status = 'completed', order_id = ?, payment_reference = ?, response_json = ? WHERE id = ?");
            $doneStmt->execute([$orderId, $paymentReference, $respJson, $idempotencyRowId]);
        }

        if (!empty($authenticatedUserEmail)) {
            try {
                $emailEngine = new EmailEngine($pdo, $config);
                $emailEngine->queueTemplate($authenticatedUserEmail, 'order_confirmation', [
                    'name' => $authenticatedUserName,
                    'order_reference' => $paymentReference,
                    'order_total' => number_format($totalAmount, 2, '.', ''),
                    'delivery_method' => $deliveryMethod,
                    'delivery_address' => $shippingAddress,
                ]);
            } catch (Throwable $e) {
                logger('error', 'ORDER_EMAIL', 'Failed to queue order confirmation email: ' . $e->getMessage());
            }
        }

        echo json_encode($responsePayload);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($idempotencyRowId) {
            try {
                $pdo->prepare("DELETE FROM order_idempotency WHERE id = ? AND status = 'pending'")->execute([$idempotencyRowId]);
            } catch (Throwable $cleanupErr) {}
        }
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}
