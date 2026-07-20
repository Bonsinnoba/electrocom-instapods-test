<?php
// backend/track_order.php
require_once 'db.php';
require_once 'cors_middleware.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'GET' || $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $content = trim(file_get_contents("php://input"));
        $decoded = json_decode($content, true);
        $orderIdStr = $decoded['order_id'] ?? '';
        $email = $decoded['email'] ?? '';
    } else {
        $orderIdStr = $_GET['order_id'] ?? '';
        $email = $_GET['email'] ?? '';
    }

    if (empty($orderIdStr) || empty($email)) {
        http_response_code(400);
        echo json_encode(['error' => 'Order ID and Email are required']);
        exit;
    }

    // Usually orders are referenced directly or by ID if fallback
    $ref = $orderIdStr;
    $id = str_replace('ORD-', '', $orderIdStr);

    try {
        // Query order and verify email matches the user who placed it
        $stmt = $pdo->prepare("
            SELECT o.id, o.payment_reference, o.order_number, o.total_amount, o.status, o.created_at, o.updated_at, o.shipping_address, o.payment_method, u.email, u.name as customer_name
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE (o.payment_reference = ? OR o.order_number = ? OR o.id = ?) AND u.email = ?
        ");
        $stmt->execute([$ref, $ref, $id, $email]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$order) {
            http_response_code(404);
            echo json_encode(['error' => 'Order not found or email does not match.']);
            exit;
        }

        $orderId = $order['id'];

        // Fetch order items
        $itemStmt = $pdo->prepare("
            SELECT p.name, oi.quantity as qty, oi.price_at_purchase as price, p.image_url
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        ");
        $itemStmt->execute([$orderId]);
        $order['items'] = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

        // Generate tracking timeline dynamically from order_status_logs
        $logsStmt = $pdo->prepare("SELECT status_key, message, created_at FROM order_status_logs WHERE order_id = ? ORDER BY created_at ASC");
        $logsStmt->execute([$orderId]);
        $logs = $logsStmt->fetchAll(PDO::FETCH_ASSOC);

        $timeline = [];
        // Add the 'placed' status manually as it depends on table created_at if no log exists
        $timeline[] = [
            'status' => 'placed',
            'label' => 'Order Placed',
            'date' => $order['created_at'],
            'completed' => true,
            'message' => 'Your order has been successfully placed.'
        ];

        // Format label names based on keys
        $statusLabels = [
            'pending' => 'Pending',
            'processing' => 'Processing',
            'received' => 'Received by Branch',
            'picking' => 'Picking in Progress',
            'picked' => 'Order Picked',
            'shipped' => 'Dispatched / Shipped',
            'delivered' => 'Delivered',
            'cancelled' => 'Cancelled'
        ];

        foreach ($logs as $log) {
            // Ignore initial pending if it's the exact same time as placed, but we can just add it
            $timeline[] = [
                'status' => $log['status_key'],
                'label' => $statusLabels[$log['status_key']] ?? ucfirst($log['status_key']),
                'date' => $log['created_at'],
                'completed' => true,
                'message' => $log['message'],
                'isError' => $log['status_key'] === 'cancelled'
            ];
        }

        $order['timeline'] = $timeline;

        echo json_encode(['success' => true, 'data' => $order]);
    } catch (Exception $e) {
        error_log("Order tracking error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to retrieve tracking information']);
    }
    exit;
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
}
