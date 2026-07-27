<?php
/**
 * customer_return_request.php
 * Allows customers to submit return requests for delivered orders.
 * Creates a pending return record that admins can review and approve.
 */

require_once 'db.php';
require_once 'security.php';
require_once 'order_utils.php';

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

/**
 * Add resolution_note / resolved_at columns to order_returns if they don't
 * exist yet. Self-healing, matching the pattern already used for the base
 * table elsewhere in this codebase.
 */
function ensure_return_resolution_columns(PDO $pdo)
{
    $hasNote = $pdo->query("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_returns' AND COLUMN_NAME = 'resolution_note'
    ")->fetchColumn();
    if (!$hasNote) {
        $pdo->exec("ALTER TABLE order_returns ADD COLUMN resolution_note TEXT NULL AFTER processed_by");
    }

    $hasResolvedAt = $pdo->query("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_returns' AND COLUMN_NAME = 'resolved_at'
    ")->fetchColumn();
    if (!$hasResolvedAt) {
        $pdo->exec("ALTER TABLE order_returns ADD COLUMN resolved_at DATETIME NULL AFTER resolution_note");
    }
}

$method = $_SERVER['REQUEST_METHOD'];

// ─── GET – customer views the status of their own return requests ──────────
// This did not exist before: a customer could submit a return request but had
// no way to ever see whether it was approved, rejected, or still pending.
if ($method === 'GET') {
    try {
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
        ensure_return_resolution_columns($pdo);

        $orderIdParam = isset($_GET['order_id']) ? (int)str_replace('ORD-', '', $_GET['order_id']) : null;

        if ($orderIdParam) {
            $stmt = $pdo->prepare("
                SELECT r.id, r.order_id, r.product_id, r.quantity, r.reason, r.status,
                       r.resolution_note, r.created_at, r.resolved_at,
                       p.name AS product_name
                FROM order_returns r
                JOIN orders o ON o.id = r.order_id
                JOIN products p ON p.id = r.product_id
                WHERE r.order_id = ? AND o.user_id = ?
                ORDER BY r.created_at DESC
            ");
            $stmt->execute([$orderIdParam, $userId]);
        } else {
            $stmt = $pdo->prepare("
                SELECT r.id, r.order_id, r.product_id, r.quantity, r.reason, r.status,
                       r.resolution_note, r.created_at, r.resolved_at,
                       p.name AS product_name
                FROM order_returns r
                JOIN orders o ON o.id = r.order_id
                JOIN products p ON p.id = r.product_id
                WHERE o.user_id = ?
                ORDER BY r.created_at DESC
                LIMIT 100
            ");
            $stmt->execute([$userId]);
        }

        echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Lookup failed']);
    }
    exit;
}

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

        // 2b. Enforce the return-eligibility window (7 days from delivery).
        // Falls back to created_at for orders placed before delivered_at existed,
        // so historical orders aren't unfairly blocked by a timestamp that was
        // never recorded for them.
        ensure_delivered_at_column($pdo);
        $returnWindowHours = 168; // 7 days

        $windowCheck = $pdo->prepare("
            SELECT
                COALESCE(delivered_at, created_at) AS window_start,
                TIMESTAMPDIFF(HOUR, COALESCE(delivered_at, created_at), UTC_TIMESTAMP()) AS hours_since
            FROM orders WHERE id = ?
        ");
        $windowCheck->execute([$orderId]);
        $windowRow = $windowCheck->fetch(PDO::FETCH_ASSOC);

        if ($windowRow && (int)$windowRow['hours_since'] > $returnWindowHours) {
            $daysAgo = round($windowRow['hours_since'] / 24, 1);
            throw new Exception(
                "This order is outside the 7-day return window (delivered {$daysAgo} days ago). "
                . "Please contact support if you believe this is an error."
            );
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
        ensure_return_resolution_columns($pdo);

        $itemCheck = $pdo->prepare("SELECT quantity FROM order_items WHERE order_id = ? AND product_id = ? FOR UPDATE");
        $sumRet = $pdo->prepare("SELECT COALESCE(SUM(quantity), 0) FROM order_returns WHERE order_id = ? AND product_id = ? AND status != 'rejected'");
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
