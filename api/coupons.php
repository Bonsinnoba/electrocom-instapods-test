<?php
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

// 1. Storefront Validation Endpoint (Public/User)
$action = validateString($_GET['action'] ?? '');

if ($method === 'POST' && $action === 'validate') {
    $data = json_decode(file_get_contents('php://input'), true);
    $code = validateString($data['code'] ?? '');
    $cartTotal = validateFloat($data['cartTotal'] ?? 0, 0, 1000000);

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

        // Calculate discount
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
    // List all coupons
    try {
        $stmt = $pdo->query("SELECT * FROM coupons ORDER BY created_at DESC");
        $coupons = $stmt->fetchAll(PDO::FETCH_ASSOC);
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

    if (!$code || $value <= 0) {
        sendResponse(false, 'Code and Valid Discount Value are required.', null, 400);
    }

    try {
        if ($id) {
            // Update
            $stmt = $pdo->prepare("UPDATE coupons SET code=?, discount_type=?, discount_value=?, min_spend=?, max_uses=?, valid_until=?, is_active=? WHERE id=?");
            $stmt->execute([$code, $type, $value, $minSpend, $maxUses, $validUntil, $isActive, $id]);
            sendResponse(true, 'Coupon updated');
        } else {
            // Create
            $stmt = $pdo->prepare("INSERT INTO coupons (code, discount_type, discount_value, min_spend, max_uses, valid_until, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$code, $type, $value, $minSpend, $maxUses, $validUntil, $isActive]);
            sendResponse(true, 'Coupon created');
        }
    } catch (PDOException $e) {
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
        $stmt = $pdo->prepare("DELETE FROM coupons WHERE id = ?");
        $stmt->execute([$id]);
        sendResponse(true, 'Coupon deleted');
    } catch (PDOException $e) {
        sendDatabaseError($e, 'Unable to delete coupon.');
    }
} else {
    sendResponse(false, 'Method not allowed', null, 405);
}
