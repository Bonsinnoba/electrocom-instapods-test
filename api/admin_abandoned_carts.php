<?php
// backend/admin_abandoned_carts.php
require 'cors_middleware.php';
require 'db.php';
require 'security.php';

header('Content-Type: application/json');

// Authenticate User
try {
    $userId = authenticate();
    $role = getUserRole($userId, $pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
}

// Require Admin/Super Role
requireRole(array_merge(RBAC_ADMIN_GROUP, RBAC_SUPER_GROUP), $pdo);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $stmt = $pdo->query("
            SELECT a.id, a.user_id, u.name as user_name, u.email as user_email, 
                   a.cart_data, a.status, a.last_updated
            FROM abandoned_carts a
            JOIN users u ON a.user_id = u.id
            WHERE a.status != 'recovered' OR a.last_updated > DATE_SUB(NOW(), INTERVAL 7 DAY)
            ORDER BY a.last_updated DESC
        ");
        $carts = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Decode cart data for each entry
        foreach ($carts as &$cart) {
            $cart['cart_data'] = json_decode($cart['cart_data'], true) ?: [];

            // Calculate total value of the cart
            $total = 0;
            foreach ($cart['cart_data'] as $item) {
                $total += (float)$item['price'] * (int)$item['quantity'];
            }
            $cart['total_value'] = $total;
        }

        echo json_encode(['success' => true, 'data' => $carts]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
