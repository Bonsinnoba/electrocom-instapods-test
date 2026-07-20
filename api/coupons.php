<?php
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

// Self-heal schema for coupon targeting
$pdo->exec("CREATE TABLE IF NOT EXISTS coupon_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    coupon_id INT NOT NULL,
    product_id INT NOT NULL,
    FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_coupon_product (coupon_id, product_id)
)");

$pdo->exec("CREATE TABLE IF NOT EXISTS coupon_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    coupon_id INT NOT NULL,
    category VARCHAR(100) NOT NULL,
    FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
    UNIQUE KEY unique_coupon_category (coupon_id, category)
)");

$method = $_SERVER['REQUEST_METHOD'];

// 1. Storefront Validation Endpoint (Public/User)
$action = validateString($_GET['action'] ?? '');

if ($method === 'POST' && $action === 'validate') {
    $data = json_decode(file_get_contents('php://input'), true);
    $code = validateString($data['code'] ?? '');
    $cartTotal = validateFloat($data['cartTotal'] ?? 0, 0, 1000000);
    $cartItems = $data['cartItems'] ?? [];

    if (!$code) {
        sendResponse(false, 'Coupon code is required', null, 400);
    }

    try {
        $stmt = $pdo->prepare("SELECT * FROM coupons WHERE code = ? AND is_active = TRUE");
        $stmt->execute([$code]);
        $coupon = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$coupon) {
            sendResponse(false, 'Invalid or expired coupon code.');
        }

        // Check if expired
        if ($coupon['valid_until'] && strtotime($coupon['valid_until']) < time()) {
            sendResponse(false, 'This coupon has expired.');
        }

        // Check uses
        if ($coupon['max_uses'] !== null && $coupon['current_uses'] >= $coupon['max_uses']) {
            sendResponse(false, 'This coupon has reached its maximum usage limit.');
        }

        // Check min spend
        if ($cartTotal > 0 && $cartTotal < (float)$coupon['min_spend']) {
            sendResponse(false, 'Minimum spend of $' . number_format($coupon['min_spend'], 2) . ' required for this coupon.');
        }

        // Check product/category restrictions
        $applicableItems = [];
        $restrictedProducts = [];
        $restrictedCategories = [];

        // Get restricted products
        $prodStmt = $pdo->prepare("SELECT product_id FROM coupon_products WHERE coupon_id = ?");
        $prodStmt->execute([$coupon['id']]);
        $restrictedProducts = $prodStmt->fetchAll(PDO::FETCH_COLUMN);

        // Get restricted categories
        $catStmt = $pdo->prepare("SELECT category FROM coupon_categories WHERE coupon_id = ?");
        $catStmt->execute([$coupon['id']]);
        $restrictedCategories = $catStmt->fetchAll(PDO::FETCH_COLUMN);

        // If coupon has restrictions, check cart items
        if (!empty($restrictedProducts) || !empty($restrictedCategories)) {
            foreach ($cartItems as $item) {
                $productId = (int)($item['id'] ?? $item['product_id'] ?? 0);
                $productCategory = $item['category'] ?? '';

                $isApplicable = false;

                // Check if product is in restricted products list
                if (in_array($productId, $restrictedProducts)) {
                    $isApplicable = true;
                }

                // Check if product category is in restricted categories
                if (!empty($restrictedCategories) && in_array($productCategory, $restrictedCategories)) {
                    $isApplicable = true;
                }

                if ($isApplicable) {
                    $applicableItems[] = $item;
                }
            }

            if (empty($applicableItems)) {
                sendResponse(false, 'This coupon is only applicable to specific products or categories.');
            }

            // Calculate discount only on applicable items
            $applicableTotal = 0;
            foreach ($applicableItems as $item) {
                $price = (float)($item['price'] ?? $item['price_at_purchase'] ?? 0);
                $qty = (int)($item['quantity'] ?? 1);
                $applicableTotal += $price * $qty;
            }

            $discountAmount = 0;
            if ($coupon['discount_type'] === 'percent') {
                $discountAmount = $applicableTotal * ((float)$coupon['discount_value'] / 100);
            } elseif ($coupon['discount_type'] === 'fixed') {
                $discountAmount = (float)$coupon['discount_value'];
            }

            // Ensure discount doesn't exceed applicable total
            $discountAmount = min($discountAmount, $applicableTotal);

            sendResponse(true, 'Coupon validated', [
                'id' => $coupon['id'],
                'code' => $coupon['code'],
                'type' => $coupon['discount_type'],
                'value' => (float)$coupon['discount_value'],
                'discountAmount' => $discountAmount,
                'applicableItems' => $applicableItems,
                'applicableTotal' => $applicableTotal
            ]);
        }

        // No restrictions - apply to entire cart
        $discountAmount = 0;
        if ($coupon['discount_type'] === 'percent') {
            $discountAmount = $cartTotal * ((float)$coupon['discount_value'] / 100);
        } elseif ($coupon['discount_type'] === 'fixed') {
            $discountAmount = (float)$coupon['discount_value'];
        }

        // Ensure discount doesn't exceed total
        $discountAmount = min($discountAmount, $cartTotal);

        sendResponse(true, 'Coupon validated', [
            'id' => $coupon['id'],
            'code' => $coupon['code'],
            'type' => $coupon['discount_type'],
            'value' => (float)$coupon['discount_value'],
            'discountAmount' => $discountAmount
        ]);
    } catch (PDOException $e) {
        sendDatabaseError($e, 'Unable to validate coupon code due to a database issue.');
    }
}

// 2. Admin Endpoints Below
try {
    $userId = authenticate();
    requireRole(['super', 'store_manager', 'marketing'], $pdo);
} catch (Exception $e) {
    sendResponse(false, 'Unauthorized', null, 401);
}

if ($method === 'GET') {
    // List all coupons with their product and category restrictions
    try {
        $stmt = $pdo->query("SELECT * FROM coupons ORDER BY created_at DESC");
        $coupons = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Enrich each coupon with its product and category restrictions
        foreach ($coupons as &$coupon) {
            // Get restricted products
            $prodStmt = $pdo->prepare("
                SELECT cp.product_id, p.name as product_name 
                FROM coupon_products cp
                JOIN products p ON cp.product_id = p.id
                WHERE cp.coupon_id = ?
            ");
            $prodStmt->execute([$coupon['id']]);
            $coupon['products'] = $prodStmt->fetchAll(PDO::FETCH_ASSOC);

            // Get restricted categories
            $catStmt = $pdo->prepare("SELECT category FROM coupon_categories WHERE coupon_id = ?");
            $catStmt->execute([$coupon['id']]);
            $coupon['categories'] = $catStmt->fetchAll(PDO::FETCH_COLUMN);
        }

        sendResponse(true, 'Coupons fetched successfully', $coupons);
    } catch (PDOException $e) {
        sendDatabaseError($e, 'Unable to retrieve coupons list.');
    }
} elseif ($method === 'POST') {
    // Create or Update Coupon
    $data = json_decode(file_get_contents('php://input'), true);

    $id = $data['id'] ?? null;
    $code = strtoupper(trim($data['code'] ?? ''));
    $type = $data['discount_type'] ?? 'percent';
    $value = (float)($data['discount_value'] ?? 0);
    $minSpend = (float)($data['min_spend'] ?? 0);
    $maxUses = isset($data['max_uses']) && $data['max_uses'] !== '' ? (int)$data['max_uses'] : null;
    $validUntil = !empty($data['valid_until']) ? $data['valid_until'] : null;
    $isActive = isset($data['is_active']) ? (int)$data['is_active'] : 1;
    $productIds = $data['product_ids'] ?? [];
    $categories = $data['categories'] ?? [];

    if (!$code || $value <= 0) {
        sendResponse(false, 'Code and Valid Discount Value are required.', null, 400);
    }

    try {
        $pdo->beginTransaction();

        if ($id) {
            // Update
            $stmt = $pdo->prepare("UPDATE coupons SET code=?, discount_type=?, discount_value=?, min_spend=?, max_uses=?, valid_until=?, is_active=? WHERE id=?");
            $stmt->execute([$code, $type, $value, $minSpend, $maxUses, $validUntil, $isActive, $id]);

            // Remove existing product and category associations
            $pdo->prepare("DELETE FROM coupon_products WHERE coupon_id = ?")->execute([$id]);
            $pdo->prepare("DELETE FROM coupon_categories WHERE coupon_id = ?")->execute([$id]);

            // Add new product associations
            if (!empty($productIds)) {
                $prodStmt = $pdo->prepare("INSERT INTO coupon_products (coupon_id, product_id) VALUES (?, ?)");
                foreach ($productIds as $productId) {
                    $prodStmt->execute([$id, (int)$productId]);
                }
            }

            // Add new category associations
            if (!empty($categories)) {
                $catStmt = $pdo->prepare("INSERT INTO coupon_categories (coupon_id, category) VALUES (?, ?)");
                foreach ($categories as $category) {
                    $catStmt->execute([$id, $category]);
                }
            }

            sendResponse(true, 'Coupon updated');
        } else {
            // Create
            $stmt = $pdo->prepare("INSERT INTO coupons (code, discount_type, discount_value, min_spend, max_uses, valid_until, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$code, $type, $value, $minSpend, $maxUses, $validUntil, $isActive]);
            $couponId = $pdo->lastInsertId();

            // Add product associations
            if (!empty($productIds)) {
                $prodStmt = $pdo->prepare("INSERT INTO coupon_products (coupon_id, product_id) VALUES (?, ?)");
                foreach ($productIds as $productId) {
                    $prodStmt->execute([$couponId, (int)$productId]);
                }
            }

            // Add category associations
            if (!empty($categories)) {
                $catStmt = $pdo->prepare("INSERT INTO coupon_categories (coupon_id, category) VALUES (?, ?)");
                foreach ($categories as $category) {
                    $catStmt->execute([$couponId, $category]);
                }
            }

            $pdo->commit();
            sendResponse(true, 'Coupon created');
        }
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($e->getCode() === '23000') { // Unique constraint violation
            sendResponse(false, 'Coupon code already exists.', null, 400);
        }
        sendDatabaseError($e, 'Unable to save coupon details.');
    }
} elseif ($method === 'DELETE') {
    // Delete Coupon
    $id = $_GET['id'] ?? null;
    if (!$id) {
        $data = json_decode(file_get_contents('php://input'), true);
        if ($data && isset($data['id'])) $id = $data['id'];
    }

    if (!$id) {
        sendResponse(false, 'ID is required', null, 400);
    }

    try {
        $pdo->beginTransaction();

        // Delete product and category associations first (will cascade due to FK, but explicit for clarity)
        $pdo->prepare("DELETE FROM coupon_products WHERE coupon_id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM coupon_categories WHERE coupon_id = ?")->execute([$id]);

        // Delete the coupon
        $stmt = $pdo->prepare("DELETE FROM coupons WHERE id = ?");
        $stmt->execute([$id]);

        $pdo->commit();
        sendResponse(true, 'Coupon deleted');
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        sendDatabaseError($e, 'Unable to delete coupon.');
    }
} else {
    sendResponse(false, 'Method not allowed', null, 405);
}
