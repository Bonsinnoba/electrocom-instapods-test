<?php
require 'cors_middleware.php';
require 'db.php';
require 'security.php';

header('Content-Type: application/json');

// Authenticate User
try {
    $userId = authenticate();
    $role = getUserRole($userId, $pdo);
    $userName = getUserName($userId, $pdo);
    
    // Restricted to Super, Admin, Branch Admin, and Store Manager
    requireRole(['super', 'store_manager'], $pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $sql = "SELECT r.*, o.id as order_display_id, COALESCE(u.name, 'In-Store Customer') as customer_name, p.name as product_name, p.product_code 
                FROM order_returns r
                JOIN orders o ON r.order_id = o.id
                LEFT JOIN users u ON o.user_id = u.id
                JOIN products p ON r.product_id = p.id
                ORDER BY r.created_at DESC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        
        $returns = $stmt->fetchAll();
        foreach ($returns as &$ret) {
            $ret['order_display_id'] = 'ORD-' . $ret['order_id'];
        }

        echo json_encode(['success' => true, 'data' => $returns]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
} elseif ($method === 'POST') {
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

        // 1. Verify order exists
        $orderCheck = $pdo->prepare("SELECT status FROM orders WHERE id = ?");
        $orderCheck->execute([$orderId]);
        $order = $orderCheck->fetch();

        if (!$order) throw new Exception("Order not found");

        // Self-heal table if needed
        $pdo->exec("CREATE TABLE IF NOT EXISTS order_returns (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            product_id INT NOT NULL,
            quantity INT NOT NULL DEFAULT 1,
            reason TEXT,
            status ENUM('pending', 'processed', 'inspected', 'rejected') DEFAULT 'processed',
            processed_by INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )");

        $itemCheck = $pdo->prepare("SELECT quantity FROM order_items WHERE order_id = ? AND product_id = ? FOR UPDATE");
        $sumRet = $pdo->prepare('SELECT COALESCE(SUM(quantity), 0) FROM order_returns WHERE order_id = ? AND product_id = ?');
        $stmt = $pdo->prepare("INSERT INTO order_returns (order_id, product_id, quantity, reason, processed_by) VALUES (?, ?, ?, ?, ?)");
        $upd = $pdo->prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?");
        
        $returnIds = [];
        $totalItemsProcessed = 0;

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
            
            // 2. Create return record
            $stmt->execute([$orderId, $productId, $quantity, $reason, $userId]);
            $returnIds[] = $pdo->lastInsertId();

            // 3. Restock product
            $upd->execute([$quantity, $productId]);
            $totalItemsProcessed += $quantity;
        }

        if (empty($returnIds)) {
            throw new Exception("No valid items provided for return.");
        }

        // 4. Log Action
        logger('ok', 'RETURNS', "$totalItemsProcessed total item(s) returned from Order $orderIdStr by $userName. Stock restocked.");

        $pdo->commit();
        echo json_encode([
            'success' => true, 
            'message' => 'Return processed and stock updated successfully.',
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
