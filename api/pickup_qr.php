<?php
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

/**
 * Generate QR Code for Order Pickup
 * Creates a unique QR code containing order verification data
 */

try {
    $userId = authenticate($pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$orderId = (int)($_GET['order_id'] ?? 0);

if ($orderId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Valid order ID required']);
    exit;
}

try {
    // Verify order belongs to user or user is staff
    $stmt = $pdo->prepare("
        SELECT o.id, o.user_id, o.order_number, o.delivery_method, o.pickup_location_id,
               o.status, o.pickup_qr_code, o.pickup_verified_at, o.pickup_verified_by,
               pl.name as pickup_location_name, pl.address as pickup_address
        FROM orders o
        LEFT JOIN pickup_locations pl ON o.pickup_location_id = pl.id
        WHERE o.id = ?
    ");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$order) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Order not found']);
        exit;
    }

    // Check authorization
    $userStmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
    $userStmt->execute([$userId]);
    $user = $userStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($order['user_id'] != $userId && !in_array($user['role'] ?? '', ['super', 'store_manager'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Access denied']);
        exit;
    }

    // Only generate QR for pickup orders
    if ($order['delivery_method'] !== 'pickup') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'QR codes only available for pickup orders']);
        exit;
    }

    // Generate or retrieve existing QR code
    $qrCode = $order['pickup_qr_code'];
    
    if (!$qrCode) {
        // Generate unique verification token
        $verificationToken = bin2hex(random_bytes(16));
        $qrData = json_encode([
            'order_id' => $orderId,
            'order_number' => $order['order_number'],
            'token' => $verificationToken,
            'timestamp' => time()
        ]);
        
        // Store QR code data in order
        $updateStmt = $pdo->prepare("UPDATE orders SET pickup_qr_code = ? WHERE id = ?");
        $updateStmt->execute([$qrData, $orderId]);
        
        $qrCode = $qrData;
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'order_id' => $orderId,
            'order_number' => $order['order_number'],
            'qr_code' => $qrCode,
            'pickup_location' => [
                'name' => $order['pickup_location_name'],
                'address' => $order['pickup_address']
            ],
            'status' => $order['status'],
            'verified' => !empty($order['pickup_verified_at']),
            'verified_at' => $order['pickup_verified_at']
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
