<?php
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

/**
 * Pickup Verification System
 * Allows staff to verify and complete order pickups using QR codes
 */

try {
    $staffId = authenticate($pdo);
    $stmt = $pdo->prepare("SELECT role, name FROM users WHERE id = ?");
    $stmt->execute([$staffId]);
    $staff = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$staff || !in_array($staff['role'], ['super', 'store_manager'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden: Only authorized staff can verify pickups.']);
        exit;
    }
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized: ' . $e->getMessage()]);
    exit;
}

// Ensure pickup verification columns exist
$cols = $pdo->query("DESCRIBE orders")->fetchAll(PDO::FETCH_COLUMN);
if (!in_array('pickup_qr_code', $cols)) {
    $pdo->exec("ALTER TABLE orders ADD COLUMN pickup_qr_code TEXT DEFAULT NULL AFTER delivery_otp");
}
if (!in_array('pickup_verified_at', $cols)) {
    $pdo->exec("ALTER TABLE orders ADD COLUMN pickup_verified_at DATETIME DEFAULT NULL AFTER pickup_qr_code");
}
if (!in_array('pickup_verified_by', $cols)) {
    $pdo->exec("ALTER TABLE orders ADD COLUMN pickup_verified_by INT DEFAULT NULL AFTER pickup_verified_at");
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Lookup order by QR code data OR order number (fallback for defective cameras)
    $qrData = $_GET['qr_data'] ?? '';
    $orderNumber = $_GET['order_number'] ?? '';
    $customerEmail = $_GET['customer_email'] ?? '';
    
    if (empty($qrData) && empty($orderNumber)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'QR code data or order number required']);
        exit;
    }

    try {
        $orderId = null;
        $verificationMethod = '';
        
        if (!empty($qrData)) {
            // QR code verification
            $decoded = json_decode($qrData, true);
            if (!$decoded || !isset($decoded['order_id'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid QR code format']);
                exit;
            }
            $orderId = (int)$decoded['order_id'];
            $verificationMethod = 'qr_code';
        } else {
            // Manual order number lookup (fallback for defective cameras)
            if (empty($customerEmail)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Customer email required for manual lookup']);
                exit;
            }
            
            // Clean order number (remove ORD- prefix if present)
            $cleanOrderNumber = preg_replace('/^ORD-/i', '', $orderNumber);
            
            $stmt = $pdo->prepare("
                SELECT id, order_number, customer_email 
                FROM orders 
                WHERE order_number = ? OR order_number = ?
            ");
            $stmt->execute([$orderNumber, 'ORD-' . $cleanOrderNumber]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$order) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Order not found']);
                exit;
            }
            
            // Verify email matches
            if (strtolower($order['customer_email']) !== strtolower($customerEmail)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Email does not match order']);
                exit;
            }
            
            $orderId = (int)$order['id'];
            $verificationMethod = 'manual';
        }
        
        $stmt = $pdo->prepare("
            SELECT o.id, o.order_number, o.user_id, o.total_amount, o.status, 
                   o.delivery_method, o.pickup_location_id, o.pickup_qr_code,
                   o.pickup_verified_at, o.pickup_verified_by,
                   u.name as customer_name, u.email as customer_email,
                   pl.name as pickup_location_name, pl.address as pickup_address,
                   verifier.name as verifier_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN pickup_locations pl ON o.pickup_location_id = pl.id
            LEFT JOIN users verifier ON o.pickup_verified_by = verifier.id
            WHERE o.id = ? AND o.delivery_method = 'pickup'
        ");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$order) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Order not found or not a pickup order']);
            exit;
        }

        // Verify QR code matches
        if ($order['pickup_qr_code'] !== $qrData) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'QR code mismatch']);
            exit;
        }

        // Get order items
        $itemsStmt = $pdo->prepare("
            SELECT oi.product_id, oi.quantity, oi.price_at_purchase,
                   p.name as product_name, p.product_code
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        ");
        $itemsStmt->execute([$orderId]);
        $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => [
                'order' => [
                    'id' => $order['id'],
                    'order_number' => $order['order_number'],
                    'total_amount' => $order['total_amount'],
                    'status' => $order['status'],
                    'customer_name' => $order['customer_name'],
                    'customer_email' => $order['customer_email']
                ],
                'pickup_location' => [
                    'name' => $order['pickup_location_name'],
                    'address' => $order['pickup_address']
                ],
                'items' => $items,
                'verification' => [
                    'verified' => !empty($order['pickup_verified_at']),
                    'verified_at' => $order['pickup_verified_at'],
                    'verified_by' => $order['verifier_name'],
                    'method' => $verificationMethod
                ]
            ]
        ]);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$qrData = $data['qr_data'] ?? '';
$orderNumber = $data['order_number'] ?? '';
$customerEmail = $data['customer_email'] ?? '';
$confirm = $data['confirm'] ?? false;

if (empty($qrData) && empty($orderNumber)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'QR code data or order number required']);
    exit;
}

if (!$confirm) {
    echo json_encode(['success' => false, 'message' => 'Confirmation required']);
    exit;
}

try {
    $orderId = null;
    
    if (!empty($qrData)) {
        // QR code verification
        $decoded = json_decode($qrData, true);
        if (!$decoded || !isset($decoded['order_id'])) {
            throw new Exception('Invalid QR code format');
        }
        $orderId = (int)$decoded['order_id'];
    } else {
        // Manual order number verification (fallback for defective cameras)
        if (empty($customerEmail)) {
            throw new Exception('Customer email required for manual verification');
        }
        
        // Clean order number (remove ORD- prefix if present)
        $cleanOrderNumber = preg_replace('/^ORD-/i', '', $orderNumber);
        
        $stmt = $pdo->prepare("
            SELECT id, order_number, customer_email, pickup_qr_code
            FROM orders 
            WHERE order_number = ? OR order_number = ?
        ");
        $stmt->execute([$orderNumber, 'ORD-' . $cleanOrderNumber]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$order) {
            throw new Exception('Order not found');
        }
        
        // Verify email matches
        if (strtolower($order['customer_email']) !== strtolower($customerEmail)) {
            throw new Exception('Email does not match order');
        }
        
        $orderId = (int)$order['id'];
    }
    
    $pdo->beginTransaction();

    // Lock and verify order
    $stmt = $pdo->prepare("
        SELECT id, order_number, status, pickup_qr_code, pickup_verified_at
        FROM orders
        WHERE id = ? AND delivery_method = 'pickup'
        FOR UPDATE
    ");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$order) {
        throw new Exception('Order not found or not a pickup order');
    }

    if ($order['pickup_qr_code'] !== $qrData) {
        throw new Exception('QR code mismatch');
    }

    if (!empty($order['pickup_verified_at'])) {
        throw new Exception('Order already verified for pickup');
    }

    if ($order['status'] !== 'processing' && $order['status'] !== 'shipped') {
        throw new Exception('Order not ready for pickup (current status: ' . $order['status'] . ')');
    }

    // Mark as verified and update status
    $updateStmt = $pdo->prepare("
        UPDATE orders 
        SET pickup_verified_at = NOW(),
            pickup_verified_by = ?,
            status = 'delivered'
        WHERE id = ?
    ");
    $updateStmt->execute([$staffId, $orderId]);

    $pdo->commit();
    
    logger('ok', 'PICKUP_VERIFY', "Order ORD-{$orderId} verified for pickup by {$staff['name']}");

    echo json_encode([
        'success' => true,
        'message' => 'Pickup verified successfully',
        'order_id' => $orderId,
        'order_number' => $order['order_number']
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
