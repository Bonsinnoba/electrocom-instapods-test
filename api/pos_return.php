<?php
/**
 * POS in-store returns: handles both POS orders (within 48 hours) and online orders (within 7 days)
 */
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

try {
    $staffId = authenticate($pdo);
    $stmt = $pdo->prepare('SELECT role, name FROM users WHERE id = ?');
    $stmt->execute([$staffId]);
    $staff = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$staff || !in_array($staff['role'], ['super', 'store_manager'], true)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden: Only authorized staff can process POS returns.']);
        exit;
    }
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized: ' . $e->getMessage()]);
    exit;
}

function normalize_pos_order_id(mixed $raw)
{
    $s = trim((string)$raw);
    $s = preg_replace('/^ORD-/i', '', $s);
    return (int)$s;
}

function ensure_returns_table(PDO $pdo)
{
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
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $orderId = normalize_pos_order_id($_GET['order_id'] ?? $_GET['id'] ?? '');
    if ($orderId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Valid order ID required']);
        exit;
    }

    try {
        ensure_returns_table($pdo);

        $oStmt = $pdo->prepare('
            SELECT id, order_type, created_at, total_amount, status
            FROM orders
            WHERE id = ?
        ');
        $oStmt->execute([$orderId]);
        $order = $oStmt->fetch(PDO::FETCH_ASSOC);

        if (!$order) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Order not found']);
            exit;
        }

        $orderType = $order['order_type'] ?? '';
        $isPosOrder = $orderType === 'pos';
        $returnWindowHours = $isPosOrder ? 48 : 168; // 48 hours for POS, 7 days (168 hours) for online orders

        $winStmt = $pdo->prepare("
            SELECT id FROM orders
            WHERE id = ?
              AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)
        ");
        $winStmt->execute([$orderId, $returnWindowHours]);
        if (!$winStmt->fetchColumn()) {
            $ageStmt = $pdo->prepare('SELECT TIMESTAMPDIFF(MINUTE, created_at, UTC_TIMESTAMP()) FROM orders WHERE id = ?');
            $ageStmt->execute([$orderId]);
            $ageMinutes = (int)$ageStmt->fetchColumn();
            $windowDesc = $isPosOrder ? '48-hour POS return window' : '7-day in-store return window for online orders';
            echo json_encode([
                'success' => false,
                'message' => "This sale is outside the {$windowDesc}.",
                'eligible' => false,
                'hours_since_sale' => round($ageMinutes / 60, 2),
                'return_window_hours' => $returnWindowHours
            ]);
            exit;
        }

        $ageStmt = $pdo->prepare('SELECT TIMESTAMPDIFF(MINUTE, created_at, UTC_TIMESTAMP()) FROM orders WHERE id = ?');
        $ageStmt->execute([$orderId]);
        $ageMinutes = (int)$ageStmt->fetchColumn();

        $itemsStmt = $pdo->prepare("
            SELECT oi.product_id, oi.quantity AS purchased_qty, oi.price_at_purchase,
                   p.name AS product_name, p.product_code
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = ?
        ");
        $itemsStmt->execute([$orderId]);
        $rows = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

        $retStmt = $pdo->prepare('SELECT COALESCE(SUM(quantity), 0) FROM order_returns WHERE order_id = ? AND product_id = ?');
        foreach ($rows as &$row) {
            $retStmt->execute([$orderId, $row['product_id']]);
            $returned = (int)$retStmt->fetchColumn();
            $row['already_returned'] = $returned;
            $row['returnable_qty'] = max(0, (int)$row['purchased_qty'] - $returned);
        }
        unset($row);

        echo json_encode([
            'success' => true,
            'eligible' => true,
            'order' => [
                'id' => $orderId,
                'display_id' => 'ORD-' . $orderId,
                'created_at' => $order['created_at'],
                'total_amount' => $order['total_amount'],
                'status' => $order['status'],
                'hours_remaining_return' => max(0, round((48 * 60 - $ageMinutes) / 60, 4)),
            ],
            'items' => $rows,
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Lookup failed']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
    exit;
}

$orderId = normalize_pos_order_id($data['order_id'] ?? '');
$items = $data['items'] ?? [];
usort($items, function($a, $b) {
    return (int)($a['product_id'] ?? 0) <=> (int)($b['product_id'] ?? 0);
});
$reason = sanitizeInput($data['reason'] ?? 'POS return');

if ($orderId <= 0 || !is_array($items) || empty($items)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'order_id and non-empty items[] required']);
    exit;
}

try {
    ensure_returns_table($pdo);
    $pdo->beginTransaction();

    // First get order details to determine type and return window
    $chk = $pdo->prepare("SELECT id, order_type, created_at FROM orders WHERE id = ?");
    $chk->execute([$orderId]);
    $row = $chk->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        throw new Exception('Order not found');
    }

    $orderType = $row['order_type'] ?? '';
    $isPosOrder = $orderType === 'pos';
    $returnWindowHours = $isPosOrder ? 48 : 168; // 48 hours for POS, 7 days for online

    $oStmt = $pdo->prepare("
        SELECT id, order_type, created_at
        FROM orders
        WHERE id = ?
          AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)
        FOR UPDATE
    ");
    $oStmt->execute([$orderId, $returnWindowHours]);
    $order = $oStmt->fetch(PDO::FETCH_ASSOC);

    if (!$order) {
        $windowDesc = $isPosOrder ? '48 hours from sale' : '7 days from sale';
        throw new Exception("Return window expired ({$windowDesc}).");
    }

    $insReturn = $pdo->prepare('INSERT INTO order_returns (order_id, product_id, quantity, reason, processed_by) VALUES (?, ?, ?, ?, ?)');
    $updStock = $pdo->prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?');
    $getLine = $pdo->prepare('SELECT quantity FROM order_items WHERE order_id = ? AND product_id = ? FOR UPDATE');
    $sumRet = $pdo->prepare('SELECT COALESCE(SUM(quantity), 0) FROM order_returns WHERE order_id = ? AND product_id = ?');

    $processed = 0;

    foreach ($items as $line) {
        $pid = (int)($line['product_id'] ?? 0);
        $qty = (int)($line['quantity'] ?? 0);
        if ($pid <= 0 || $qty <= 0) {
            continue;
        }

        $getLine->execute([$orderId, $pid]);
        $purchased = (int)$getLine->fetchColumn();
        if ($purchased <= 0) {
            throw new Exception("Product #{$pid} is not on this order.");
        }

        $sumRet->execute([$orderId, $pid]);
        $already = (int)$sumRet->fetchColumn();
        $canReturn = $purchased - $already;
        if ($qty > $canReturn) {
            throw new Exception("Return qty {$qty} exceeds returnable amount ({$canReturn}) for product #{$pid}.");
        }

        $insReturn->execute([$orderId, $pid, $qty, $reason, $staffId]);
        $updStock->execute([$qty, $pid]);
        $processed += $qty;
    }

    if ($processed === 0) {
        throw new Exception('No valid line items to return.');
    }

    $pdo->commit();
    logger('ok', 'POS_RETURN', "POS return on ORD-{$orderId}: {$processed} units by {$staff['name']}");

    echo json_encode([
        'success' => true,
        'message' => 'Return processed and stock updated.',
        'units_returned' => $processed,
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
