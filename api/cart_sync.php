<?php
// backend/cart_sync.php
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $userId = authenticate($pdo, false);
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['success' => false, 'cart' => []]);
        exit;
    }

    $stmt = $pdo->prepare("SELECT cart_data FROM abandoned_carts WHERE user_id = ? AND status IN ('active', 'abandoned') ORDER BY last_updated DESC LIMIT 1");
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    $cart = $row ? (json_decode($row['cart_data'], true) ?? []) : [];

    echo json_encode(['success' => true, 'cart' => $cart]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Only logged in users can have their carts synced (since we need an email to send recovery to)
    $userId = authenticate($pdo, false); // don't exit if fails, just return below

    if (!$userId) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        exit;
    }

    $content = trim(file_get_contents("php://input"));
    $decoded = json_decode($content, true);

    if (!is_array($decoded) || !isset($decoded['cart'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON payload']);
        exit;
    }

    $cartData = json_encode($decoded['cart']);

    try {
        // Check if an active/abandoned cart exists for this user
        $stmt = $pdo->prepare("SELECT id FROM abandoned_carts WHERE user_id = ? AND status IN ('active', 'abandoned') LIMIT 1");
        $stmt->execute([$userId]);
        $existingId = $stmt->fetchColumn();

        if (empty($decoded['cart'])) {
            // Cart is empty, mark as recovered if it existed
            if ($existingId) {
                $pdo->prepare("UPDATE abandoned_carts SET status = 'recovered', cart_data = '[]' WHERE id = ?")->execute([$existingId]);
            }
            echo json_encode(['success' => true, 'message' => 'Cart empty, marked recovered']);
            exit;
        }

        if ($existingId) {
            // Update existing cart, reset status to active since they just touched it
            $upd = $pdo->prepare("UPDATE abandoned_carts SET cart_data = ?, status = 'active', last_updated = CURRENT_TIMESTAMP WHERE id = ?");
            $upd->execute([$cartData, $existingId]);
        } else {
            // Insert new cart
            $ins = $pdo->prepare("INSERT INTO abandoned_carts (user_id, cart_data, status) VALUES (?, ?, 'active')");
            $ins->execute([$userId, $cartData]);
        }

        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        error_log("Cart sync error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to sync cart']);
    }
    exit;
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
}
