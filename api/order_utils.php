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

/**
 * Self-heal: add a delivered_at timestamp column to orders if it doesn't
 * exist yet. This is the real timestamp a customer-facing return-eligibility
 * window should be measured against — previously there was no such column
 * anywhere, so no accurate "X days since delivery" check was possible.
 */
if (!function_exists('ensure_delivered_at_column')) {
    function ensure_delivered_at_column(PDO $pdo)
    {
        $has = $pdo->query("
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'delivered_at'
        ")->fetchColumn();
        if (!$has) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN delivered_at DATETIME NULL AFTER status");
        }
    }
}

/**
 * Self-heal: create every table (and widen the users.role enum, and add the
 * orders linkage columns) needed for institutional quotes and the delivery
 * infrastructure (self-fleet + carrier), mirroring migrations 038-047
 * exactly. This is the same class of gap that bit site_settings and
 * admin_messages earlier this session — migrations exist as files, but
 * nothing guarantees they were actually run against the live database.
 * Safe to call on every request: everything here is CREATE TABLE IF NOT
 * EXISTS, or an idempotent existence check before ALTER.
 */
if (!function_exists('ensure_institutional_and_delivery_tables')) {
    function ensure_institutional_and_delivery_tables(PDO $pdo)
    {
        static $checked = false;
        if ($checked) return;
        $checked = true;

        // --- Migration 038: widen users.role enum to include 'sales' ---
        try {
            $col = $pdo->query("
                SELECT COLUMN_TYPE FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'
            ")->fetchColumn();
            if ($col && stripos($col, "'sales'") === false) {
                $pdo->exec("ALTER TABLE users MODIFY COLUMN role ENUM(
                    'customer', 'store_manager', 'marketing', 'accountant',
                    'pos_cashier', 'picker', 'sales', 'super'
                ) DEFAULT 'customer'");
            }
        } catch (Throwable $e) {
            error_log('ensure_institutional_and_delivery_tables: role enum widen failed - ' . $e->getMessage());
        }

        // --- Migration 039: institutions + institution_contacts ---
        $pdo->exec("CREATE TABLE IF NOT EXISTS institutions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            type ENUM('school', 'hospital', 'corporate', 'government', 'ngo', 'other') DEFAULT 'other',
            tax_id VARCHAR(100) DEFAULT NULL,
            billing_address TEXT,
            phone VARCHAR(20),
            email VARCHAR(255),
            status ENUM('pending', 'verified', 'suspended') DEFAULT 'pending',
            verified_by INT DEFAULT NULL,
            verified_at DATETIME DEFAULT NULL,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
            INDEX idx_institutions_status (status)
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS institution_contacts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            institution_id INT NOT NULL,
            user_id INT NOT NULL,
            title VARCHAR(100) DEFAULT NULL,
            is_primary BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_institution_user (institution_id, user_id)
        )");

        // --- Migration 040: quote_requests + quote_request_items ---
        $pdo->exec("CREATE TABLE IF NOT EXISTS quote_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            institution_id INT NOT NULL,
            submitted_by INT NOT NULL,
            status ENUM('draft', 'submitted', 'under_review', 'quoted', 'accepted', 'rejected', 'expired') DEFAULT 'draft',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
            FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_quote_requests_status (status),
            INDEX idx_quote_requests_institution (institution_id)
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS quote_request_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            quote_request_id INT NOT NULL,
            product_id INT DEFAULT NULL,
            quantity INT NOT NULL DEFAULT 1,
            notes TEXT,
            FOREIGN KEY (quote_request_id) REFERENCES quote_requests(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
            INDEX idx_quote_request_items_request (quote_request_id)
        )");

        // --- Migration 041: quotes + quote_items + quote_activity_log ---
        $pdo->exec("CREATE TABLE IF NOT EXISTS quotes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            quote_request_id INT NOT NULL,
            created_by INT NOT NULL,
            subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            discount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            tax DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            payment_terms ENUM('due_on_receipt', 'net_15', 'net_30', 'net_60') DEFAULT 'due_on_receipt',
            valid_until DATE DEFAULT NULL,
            terms_notes TEXT,
            status ENUM('draft', 'sent', 'accepted', 'rejected', 'expired') DEFAULT 'draft',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (quote_request_id) REFERENCES quote_requests(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_quotes_status (status)
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS quote_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            quote_id INT NOT NULL,
            product_id INT DEFAULT NULL,
            description VARCHAR(255) DEFAULT NULL,
            quantity INT NOT NULL DEFAULT 1,
            unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
            INDEX idx_quote_items_quote (quote_id)
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS quote_activity_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            quote_request_id INT NOT NULL,
            status_key VARCHAR(50) NOT NULL,
            message TEXT NOT NULL,
            actor_id INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (quote_request_id) REFERENCES quote_requests(id) ON DELETE CASCADE,
            FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
            INDEX idx_quote_activity_request (quote_request_id, created_at)
        )");

        // --- Migration 042: orders linkage columns ---
        $hasInstitutionId = $pdo->query("
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'institution_id'
        ")->fetchColumn();
        if (!$hasInstitutionId) {
            $pdo->exec("ALTER TABLE orders
                ADD COLUMN institution_id INT DEFAULT NULL AFTER user_id,
                ADD COLUMN quote_id INT DEFAULT NULL AFTER institution_id,
                ADD CONSTRAINT fk_orders_institution FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL,
                ADD CONSTRAINT fk_orders_quote FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL,
                ADD INDEX idx_orders_institution (institution_id)");
        }

        // --- Migration 043: shipping_zones ---
        $pdo->exec("CREATE TABLE IF NOT EXISTS shipping_zones (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            region VARCHAR(100) DEFAULT NULL,
            center_lat DECIMAL(10, 7) DEFAULT NULL,
            center_lng DECIMAL(10, 7) DEFAULT NULL,
            radius_km DECIMAL(6, 2) DEFAULT NULL,
            base_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            per_km_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_shipping_zones_active (is_active)
        )");

        // --- Migration 044: riders ---
        $pdo->exec("CREATE TABLE IF NOT EXISTS riders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT DEFAULT NULL,
            name VARCHAR(150) NOT NULL,
            phone VARCHAR(20) NOT NULL,
            vehicle_type ENUM('bike', 'motorcycle', 'car', 'van') DEFAULT 'motorcycle',
            status ENUM('available', 'on_delivery', 'offline') DEFAULT 'offline',
            default_zone_id INT DEFAULT NULL,
            current_lat DECIMAL(10, 7) DEFAULT NULL,
            current_lng DECIMAL(10, 7) DEFAULT NULL,
            last_location_update DATETIME DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (default_zone_id) REFERENCES shipping_zones(id) ON DELETE SET NULL,
            INDEX idx_riders_status (status)
        )");

        // --- Migration 045: shipments ---
        $pdo->exec("CREATE TABLE IF NOT EXISTS shipments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            provider_type ENUM('self_fleet', 'carrier') NOT NULL DEFAULT 'self_fleet',
            zone_id INT DEFAULT NULL,
            rider_id INT DEFAULT NULL,
            carrier_name VARCHAR(100) DEFAULT NULL,
            tracking_number VARCHAR(150) DEFAULT NULL,
            status ENUM('pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'cancelled') DEFAULT 'pending',
            cost DECIMAL(10, 2) DEFAULT 0.00,
            origin_address TEXT,
            destination_address TEXT,
            estimated_delivery DATETIME DEFAULT NULL,
            delivered_at DATETIME DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY (zone_id) REFERENCES shipping_zones(id) ON DELETE SET NULL,
            FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE SET NULL,
            INDEX idx_shipments_order (order_id),
            INDEX idx_shipments_status (status),
            INDEX idx_shipments_rider (rider_id)
        )");

        // --- Migration 046: carrier_credentials ---
        $pdo->exec("CREATE TABLE IF NOT EXISTS carrier_credentials (
            id INT AUTO_INCREMENT PRIMARY KEY,
            carrier_name VARCHAR(100) NOT NULL UNIQUE,
            display_name VARCHAR(150) DEFAULT NULL,
            api_key_encrypted TEXT DEFAULT NULL,
            api_secret_encrypted TEXT DEFAULT NULL,
            account_number VARCHAR(100) DEFAULT NULL,
            sandbox_mode BOOLEAN DEFAULT TRUE,
            is_enabled BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )");

        // --- Migration 047: delivery provider settings (site_settings rows) ---
        try {
            if (function_exists('eh_ensure_site_settings_table')) {
                eh_ensure_site_settings_table($pdo);
            }
            $pdo->exec("INSERT INTO site_settings (setting_key, setting_value, value_type, category, description, is_public) VALUES
                ('activeDeliveryProviderMode', 'self_fleet', 'string', 'delivery', 'Which provider mode fulfills door-to-door orders: self_fleet, carrier, or both (zone-routed)', FALSE),
                ('selfFleetEnabled', 'true', 'boolean', 'delivery', 'Whether the self-owned fleet is currently operational', FALSE),
                ('carrierFallbackEnabled', 'false', 'boolean', 'delivery', 'Whether to fall back to a carrier when no self-fleet zone/rider is available', FALSE)
                ON DUPLICATE KEY UPDATE setting_value = setting_value");
        } catch (Throwable $e) {
            error_log('ensure_institutional_and_delivery_tables: delivery settings seed failed - ' . $e->getMessage());
        }
    }
}
