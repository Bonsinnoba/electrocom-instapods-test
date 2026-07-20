<?php
/**
 * customer_return_request.php
 * Allows customers to submit return requests for delivered orders.
 * Creates a pending return record that admins can review and approve.
 */

require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

// Authenticate User
try {
    $userId = authenticate($pdo);
    $userName = getUserName($userId, $pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $content = trim(file_get_contents("php://input"));
    $decoded = json_decode($content, true);
    
    $orderIdStr = $decoded['order_id'] ?? null;
    $items = $decoded['items'] ?? [];
    $reason = sanitizeInput($decoded['reason'] ?? 'Not specified');

    if (!$orderIdStr || !is_array($items) || empty($items)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Order ID and items array are required']);
        exit;
    }

    $orderId = str_replace('ORD-', '', $orderIdStr);

    try {
        $pdo->beginTransaction();

        // 1. Verify order exists and belongs to the user
        $orderCheck = $pdo->prepare("SELECT id, status, user_id FROM orders WHERE id = ?");
        $orderCheck->execute([$orderId]);
        $order = $orderCheck->fetch();

        if (!$order) {
            throw new Exception("Order not found");
        }

        if ($order['user_id'] != $userId) {
            throw new Exception("You can only request returns for your own orders");
        }

        // 2. Verify order is delivered/completed
        if (!in_array($order['status'], ['delivered', 'completed'])) {
            throw new Exception("Returns can only be requested for delivered orders");
        }

        // 3. Self-heal table if needed
        $pdo->exec("CREATE TABLE IF NOT EXISTS order_returns (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            product_id INT NOT NULL,
            quantity INT NOT NULL DEFAULT 1,
            reason TEXT,
            status ENUM('pending', 'processed', 'inspected', 'rejected') DEFAULT 'pending',
            processed_by INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )");

        $itemCheck = $pdo->prepare("SELECT quantity FROM order_items WHERE order_id = ? AND product_id = ? FOR UPDATE");
        $sumRet = $pdo->prepare('SELECT COALESCE(SUM(quantity), 0) FROM order_returns WHERE order_id = ? AND product_id = ?');
        $stmt = $pdo->prepare("INSERT INTO order_returns (order_id, product_id, quantity, reason, status) VALUES (?, ?, ?, ?, 'pending')");
        
        $returnIds = [];
        $totalItemsRequested = 0;

        foreach ($items as $item) {
            $productId = (int)($item['product_id'] ?? 0);
            $quantity = (int)($item['quantity'] ?? 0);
            
            if ($productId <= 0 || $quantity <= 0) continue;

            $itemCheck->execute([$orderId, $productId]);
            $purchasedQty = (int)$itemCheck->fetchColumn();

            if ($purchasedQty <= 0) {
                throw new Exception("Product #{$productId} is not on this order.");
            }

            $sumRet->execute([$orderId, $productId]);
            $alreadyReturned = (int)$sumRet->fetchColumn();

            $canReturn = $purchasedQty - $alreadyReturned;
            if ($quantity > $canReturn) {
                 throw new Exception("Return quantity ({$quantity}) exceeds returnable amount ({$canReturn}) for product #{$productId}.");
            }
            
            // Create pending return record
            $stmt->execute([$orderId, $productId, $quantity, $reason]);
            $returnIds[] = $pdo->lastInsertId();
            $totalItemsRequested += $quantity;
        }

        if (empty($returnIds)) {
            throw new Exception("No valid items provided for return.");
        }

        // 4. Log Action
        logger('ok', 'RETURNS', "Customer return request for {$totalItemsRequested} item(s) from Order $orderIdStr by $userName. Status: pending approval.");

        // 5. Notify admins
        $pdo->prepare("INSERT INTO notifications (user_id, title, message, type) SELECT id, ?, ?, 'return_request' FROM users WHERE role IN ('admin', 'super', 'store_manager')")
            ->execute(["New Return Request", "Customer $userName has requested a return for Order $orderIdStr with {$totalItemsRequested} item(s)."]);

        $pdo->commit();
        echo json_encode([
            'success' => true, 
            'message' => 'Return request submitted successfully. Awaiting admin approval.',
            'return_ids' => $returnIds
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
