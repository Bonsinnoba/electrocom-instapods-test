<?php
header('Content-Type: application/json');
require_once 'config.php';
require_once 'auth.php';

// Get request method
$method = $_SERVER['REQUEST_METHOD'];

// Get authenticated user
$user = getAuthenticatedUser();
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

try {
    $pdo = getPDO();

    if ($method === 'POST') {
        // Create a new stock notification request
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['product_id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Product ID is required']);
            exit;
        }

        $product_id = intval($data['product_id']);
        $email = $data['email'] ?? $user['email'];
        $phone = $data['phone'] ?? $user['phone'] ?? null;
        $notification_method = $data['notification_method'] ?? 'both';

        // Validate notification method
        if (!in_array($notification_method, ['email', 'sms', 'both'])) {
            $notification_method = 'both';
        }

        // Check if user already has a pending notification for this product
        $stmt = $pdo->prepare("SELECT id FROM stock_notifications WHERE user_id = ? AND product_id = ? AND status = 'pending'");
        $stmt->execute([$user['id'], $product_id]);
        if ($stmt->fetch()) {
            echo json_encode(['success' => true, 'message' => 'You already have a pending notification request for this product']);
            exit;
        }

        // Insert stock notification request
        $stmt = $pdo->prepare("INSERT INTO stock_notifications (user_id, product_id, email, phone, notification_method, status) VALUES (?, ?, ?, ?, ?, 'pending')");
        $stmt->execute([$user['id'], $product_id, $email, $phone, $notification_method]);

        echo json_encode(['success' => true, 'message' => 'You will be notified when this product is back in stock']);

    } elseif ($method === 'GET') {
        // Get user's stock notification requests
        $stmt = $pdo->prepare("
            SELECT sn.*, p.name as product_name, p.image as product_image, p.stock_quantity
            FROM stock_notifications sn
            JOIN products p ON sn.product_id = p.id
            WHERE sn.user_id = ?
            ORDER BY sn.created_at DESC
        ");
        $stmt->execute([$user['id']]);
        $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'notifications' => $notifications]);

    } elseif ($method === 'DELETE') {
        // Cancel a stock notification request
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['notification_id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Notification ID is required']);
            exit;
        }

        $notification_id = intval($data['notification_id']);

        // Update status to cancelled
        $stmt = $pdo->prepare("UPDATE stock_notifications SET status = 'cancelled' WHERE id = ? AND user_id = ?");
        $stmt->execute([$notification_id, $user['id']]);

        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'message' => 'Notification request cancelled']);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Notification request not found']);
        }

    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }

} catch (PDOException $e) {
    error_log("Stock notifications error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error']);
}
