<?php
require_once 'db.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

// Authentication
try {
    $userId = authenticate($pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

if ($method === 'GET') {
    // List wishlist items
    try {
        $stmt = $pdo->prepare("
            SELECT w.id as wishlist_id, p.* 
            FROM wishlists w 
            JOIN products p ON w.product_id = p.id 
            WHERE w.user_id = ?
            ORDER BY w.created_at DESC
        ");
        $stmt->execute([$userId]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Map data structure similar to get_products.php
        $mappedItems = array_map(function ($p) {
            return [
                'wishlist_id' => $p['wishlist_id'],
                'id' => $p['id'],
                'name' => $p['name'],
                'category' => $p['category'],
                'price' => (float)$p['price'],
                'rating' => (float)($p['rating'] ?? 5.0),
                'stock' => (int)$p['stock_quantity'],
                'image' => $p['image_url'],
                'product_code' => $p['product_code'],
                'location' => $p['location'],
                'colors' => json_decode($p['colors'] ?? '[]', true) ?: [],
                'isNew' => (time() - strtotime($p['created_at'])) < (7 * 24 * 60 * 60)
            ];
        }, $items);

        echo json_encode(['success' => true, 'items' => $mappedItems]);
    } catch (PDOException $e) {
        sendDatabaseError($e, 'Unable to retrieve your wishlist items.');
    }
} elseif ($method === 'POST') {
    // Add to wishlist
    $data = json_decode(file_get_contents('php://input'), true);
    $productId = $data['product_id'] ?? null;

    if (!$productId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Product ID is required']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("INSERT IGNORE INTO wishlists (user_id, product_id) VALUES (?, ?)");
        $stmt->execute([$userId, $productId]);
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        sendDatabaseError($e, 'Unable to add product to your wishlist.');
    }
} elseif ($method === 'DELETE') {
    // Remove from wishlist
    parse_str(file_get_contents("php://input"), $deleteParams);
    // If not passed in body as x-www-form-urlencoded, check query string
    $productId = $_GET['product_id'] ?? $deleteParams['product_id'] ?? null;

    if (!$productId && isset($_GET['product_id'])) {
        $productId = $_GET['product_id'];
    } else {
        $data = json_decode(file_get_contents('php://input'), true);
        if ($data && isset($data['product_id'])) $productId = $data['product_id'];
    }

    if (!$productId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Product ID is required']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?");
        $stmt->execute([$userId, $productId]);
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        sendDatabaseError($e, 'Unable to remove product from your wishlist.');
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
