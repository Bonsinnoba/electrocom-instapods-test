<?php
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

/**
 * POS Checkout Handler
 * High-speed endpoint for physical store sales.
 * Refactored for Single Warehouse (Branching removed).
 */

// 1. Authenticate Staff
try {
    $cashierId = authenticate($pdo);
    $stmt = $pdo->prepare("SELECT role, name FROM users WHERE id = ?");
    $stmt->execute([$cashierId]);
    $cashier = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$cashier || !in_array($cashier['role'], ['super', 'store_manager'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden: Only authorized staff can perform POS sales.']);
        exit;
    }
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized: ' . $e->getMessage()]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$rawData = file_get_contents('php://input');
$data = json_decode($rawData, true);

if (!$data || empty($data['items'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid transaction data.']);
    exit;
}

$items = $data['items'];
usort($items, function($a, $b) {
    return (int)($a['id'] ?? 0) <=> (int)($b['id'] ?? 0);
});
$totalAmount = (float)($data['total_amount'] ?? 0);
$paymentMethod = sanitizeInput($data['payment_method'] ?? 'cash');
$customerEmail = sanitizeInput($data['customer_email'] ?? '');

try {
    $pdo->beginTransaction();

    // 2. Identify/Link Customer
    $customerId = null;
    if ($customerEmail) {
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$customerEmail]);
        $customerId = $stmt->fetchColumn() ?: null;
    }

    // 3. Create POS Order
    $stmt = $pdo->prepare("
        INSERT INTO orders (
            user_id, total_amount, status, payment_method, 
            order_type, cashier_id
        ) VALUES (?, ?, 'delivered', ?, 'pos', ?)
    ");
    $stmt->execute([$customerId, $totalAmount, $paymentMethod, $cashierId]);
    $orderId = $pdo->lastInsertId();

    // 4. Process Items & Deduct Stock
    require_once 'inventory_utils.php';
    $insertItem = $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)");
    $updateStock = $pdo->prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?");

    foreach ($items as $item) {
        $pId = (int)$item['id'];
        $qty = (int)$item['quantity'];

        // Lock row
        $lockStmt = $pdo->prepare("SELECT name, stock_quantity FROM products WHERE id = ? FOR UPDATE");
        $lockStmt->execute([$pId]);
        $prod = $lockStmt->fetch(PDO::FETCH_ASSOC);

        if (!$prod) throw new Exception("Product ID {$pId} not found.");

        // Check availability
        $available = getAvailableStock($pId, $pdo);
        if ($available < $qty) {
            throw new Exception("Insufficient stock for '{$prod['name']}'. Requested: {$qty}, Available: {$available}.");
        }

        // Price logic
        $priceStmt = $pdo->prepare("SELECT price, discount_percent, sale_ends_at FROM products WHERE id = ?");
        $priceStmt->execute([$pId]);
        $priceData = $priceStmt->fetch(PDO::FETCH_ASSOC);

        require_once 'order_utils.php'; 
        $price = function_exists('getEffectivePrice') ? getEffectivePrice($priceData) : (float)$priceData['price'];

        $insertItem->execute([$orderId, $pId, $qty, $price]);
        $updateStock->execute([$qty, $pId]);

        // Low stock alerts
        if (($prod['stock_quantity'] - $qty) <= 10) {
            $notifTitle = "Low Stock: " . $prod['name'];
            $notifMsg = "Physical sale (ORD-{$orderId}) reduced stock to " . ($prod['stock_quantity'] - $qty);
            $pdo->prepare("INSERT INTO notifications (user_id, title, message, type) SELECT id, ?, ?, 'system' FROM users WHERE role IN ('store_manager', 'super')")
                ->execute([$notifTitle, $notifMsg]);
        }
    }

    // 5. Loyalty Points
    if ($customerId) {
        $points = floor($totalAmount / 10);
        if ($points > 0) {
            // Lock user row to prevent race conditions with concurrent point updates
            $lockStmt = $pdo->prepare("SELECT loyalty_points FROM users WHERE id = ? FOR UPDATE");
            $lockStmt->execute([$customerId]);
            
            $pdo->prepare("UPDATE users SET loyalty_points = loyalty_points + ? WHERE id = ?")->execute([$points, $customerId]);
        }
    }

    $pdo->commit();
    logger('ok', 'POS', "Physical sale completed: ORD-{$orderId} by {$cashier['name']}");

    echo json_encode([
        'success' => true,
        'message' => 'Sale completed successfully',
        'order_id' => $orderId
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Transaction failed. ' . $e->getMessage()]);
}
