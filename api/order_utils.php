<?php
// backend/order_utils.php
function completeOrder($orderId, $pdo) {
    try {
        // 1. Fetch Order Details
        $stmt = $pdo->prepare("
            SELECT o.*, u.name as user_name, u.email, u.phone, u.email_notif, u.sms_tracking
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.id = ?
        ");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$order) {
            throw new Exception("Order #{$orderId} not found.");
        }

        // ATOMIC GATE: Begin transaction if not already active (e.g., when called from webhook handlers)
        // SELECT FOR UPDATE ensures only one concurrent call proceeds;
        // the second caller will block until the first commits/rolls back.
        $transactionStarted = false;
        if (!$pdo->inTransaction()) {
            $pdo->beginTransaction();
            $transactionStarted = true;
        }

        $lockStmt = $pdo->prepare("SELECT status FROM orders WHERE id = ? FOR UPDATE");
        $lockStmt->execute([$orderId]);
        $lockedStatus = $lockStmt->fetchColumn();

        // If already processing/shipped/delivered/cancelled, another call got here first.
        if (in_array($lockedStatus, ['processing', 'shipped', 'delivered', 'cancelled'])) {
            if ($transactionStarted) {
                $pdo->rollBack();
            }
            return false;
        }
        $itemStmt = $pdo->prepare("
            SELECT oi.*, p.name as product_name, p.stock_quantity
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        ");
        $itemStmt->execute([$orderId]);
        $items = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

        // 2. Simplistic Fulfillment (No branch routing)
        // Mark as processing
        $pdo->prepare("UPDATE orders SET status = 'processing' WHERE id = ?")
            ->execute([$orderId]);

        // 4. Update Global Stock (for storefront availability)
        $updateStockStmt = $pdo->prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?");
        $adminNotifyStmt = $pdo->prepare("INSERT INTO notifications (user_id, title, message, type) SELECT id, ?, ?, 'info' FROM users WHERE role = 'store_manager' OR role = 'super'");

        foreach ($items as $item) {
            // Lock product row to prevent race conditions with concurrent orders
            $lockStmt = $pdo->prepare("SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE");
            $lockStmt->execute([$item['product_id']]);
            $currentStock = $lockStmt->fetchColumn();
            
            $updateStockStmt->execute([$item['quantity'], $item['product_id'], $item['quantity']]);
            if ($updateStockStmt->rowCount() === 0) {
                throw new Exception("Insufficient stock for '{$item['product_name']}'. Requested: {$item['quantity']}, Available: {$currentStock}.");
            }

            // Low Stock Check
            $newStock = $currentStock - $item['quantity'];
            if ($newStock <= 10) {
                $adminNotifyStmt->execute(["Low Stock Alert", "Product '{$item['product_name']}' is running low on stock. Only {$newStock} remaining."]);
            }
        }

        // 5. Update Coupon Uses
        if ($order['coupon_code']) {
            $pdo->prepare("UPDATE coupons SET current_uses = current_uses + 1 WHERE code = ?")->execute([$order['coupon_code']]);
        }

        // 6. Mark Abandoned Cart as Recovered
        $pdo->prepare("UPDATE abandoned_carts SET status = 'recovered', cart_data = '[]' WHERE user_id = ? AND status = 'active'")->execute([$order['user_id']]);

        // 7. In-App Notifications
        $paymentRef = $order['payment_reference'] ?: $order['order_number'] ?: "ORD-{$orderId}";
        
        $pdo->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'order')")
            ->execute([$order['user_id'], "Order Placed Successfully", "Your order {$paymentRef} has been received and is being processed."]);

        $pdo->prepare("INSERT INTO notifications (user_id, title, message, type) SELECT id, ?, ?, 'order' FROM users WHERE role IN ('store_manager', 'super')")
            ->execute(["New Order Received", "Order {$paymentRef} has been placed by {$order['user_name']} for GH\xc2\xa2 {$order['total_amount']}."]);

        // 7b. Award new Loyalty Points (1 point per GHS 10 spent)
        $pointsEarned = (int)floor($order['total_amount'] / 10);
        if ($pointsEarned > 0) {
            // Lock user row to prevent race conditions with concurrent point updates
            $lockStmt = $pdo->prepare("SELECT loyalty_points FROM users WHERE id = ? FOR UPDATE");
            $lockStmt->execute([$order['user_id']]);
            
            $pdo->prepare("UPDATE users SET loyalty_points = loyalty_points + ? WHERE id = ?")
                ->execute([$pointsEarned, $order['user_id']]);
        }

        // Only commit if we started the transaction
        if ($transactionStarted) {
            $pdo->commit();
        }

        // 8. Communications (Email/SMS)
        try {
            require_once 'notifications.php';
            $notifier = new NotificationService();

            require_once __DIR__ . '/brand_settings.php';
            $brandName = eh_brand_site_name();

            if ($order['email'] && ($order['email_notif'] ?? true)) {
                $itemsList = "";
                foreach ($items as $item) {
                    $itemsList .= "  - {$item['product_name']} (x{$item['quantity']}) — GHS " . number_format($item['price_at_purchase'], 2) . "\n";
                }

                $subject = "{$brandName} — Order Confirmed ({$paymentRef})";
                $msg = "Hi {$order['user_name']},\n\n"
                    . "Thank you for your order! Your payment has been verified.\n\n"
                    . "Order Reference: {$paymentRef}\n"
                    . "Delivery Code: {$order['delivery_otp']}\n"
                    . "Date: " . date('d M Y, h:i A') . "\n"
                    . "Payment: {$order['payment_method']}\n\n"
                    . "Items:\n{$itemsList}\n"
                    . "Total: GHS " . number_format($order['total_amount'], 2) . "\n"
                    . "Shipping To: {$order['shipping_address']}\n\n"
                    . "IMPORTANT: Please provide the Delivery Code ({$order['delivery_otp']}) to the agent upon arrival.\n\n"
                    . "— The {$brandName} Team";

                $notifier->queueNotification('email', $order['email'], $msg, $subject);
            }

            if ($order['phone'] && ($order['sms_tracking'] ?? true)) {
                $smsMsg = "{$brandName} Order {$paymentRef}: Your order for GHS " . number_format($order['total_amount'], 2) . " has been received! Delivery Code: {$order['delivery_otp']}.";
                $notifier->queueNotification('sms', $order['phone'], $smsMsg);
            }
        } catch (Exception $commErr) {
            error_log("Order completion communication failed: " . $commErr->getMessage());
        }

        return true;
    } catch (Exception $e) {
        // Only rollback if we started the transaction
        if ($transactionStarted && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log("Order completion error: " . $e->getMessage());
        return false;
    }
}

/**
 * Log a granular event for the order tracking timeline.
 */
if (!function_exists('logOrderEvent')) {
    function logOrderEvent($orderId, $statusKey, $message, $pdo) {
        try {
            $stmt = $pdo->prepare("INSERT INTO order_status_logs (order_id, status_key, message) VALUES (?, ?, ?)");
            $stmt->execute([$orderId, $statusKey, $message]);
            return true;
        } catch (Exception $e) {
            error_log("Failed to log order event: " . $e->getMessage());
            return false;
        }
    }
}
