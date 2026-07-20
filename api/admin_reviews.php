<?php
// backend/admin_reviews.php
require 'cors_middleware.php';
require 'db.php';
require 'security.php';

header('Content-Type: application/json');

// Authenticate User
try {
    $userId = authenticate();
    $role = getUserRole($userId, $pdo);
    $userName = getUserName($userId, $pdo);
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
            SELECT r.id, r.rating, r.comment, r.created_at, 
                   u.name as user_name, u.email as user_email,
                   p.name as product_name, p.id as product_id
            FROM product_reviews r
            JOIN users u ON r.user_id = u.id
            JOIN products p ON r.product_id = p.id
            ORDER BY r.created_at DESC
        ");
        $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'data' => $reviews]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
} elseif ($method === 'POST') {
    $content = trim(file_get_contents("php://input"));
    $decoded = json_decode($content, true);
    $action = $decoded['action'] ?? '';

    if ($action === 'delete') {
        $id = (int)($decoded['id'] ?? 0);

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Review ID is required']);
            exit;
        }

        try {
            // Get product_id before deleting to update its average
            $getStmt = $pdo->prepare("SELECT product_id FROM product_reviews WHERE id = ?");
            $getStmt->execute([$id]);
            $productId = $getStmt->fetchColumn();

            $stmt = $pdo->prepare("DELETE FROM product_reviews WHERE id = ?");
            $stmt->execute([$id]);

            if ($productId) {
                // Update the product's average rating with row locking to prevent race conditions
                $pdo->beginTransaction();
                
                $lockStmt = $pdo->prepare("SELECT rating FROM products WHERE id = ? FOR UPDATE");
                $lockStmt->execute([$productId]);
                
                $avgStmt = $pdo->prepare("SELECT AVG(rating) as avg_rating FROM product_reviews WHERE product_id = ?");
                $avgStmt->execute([$productId]);
                $avgRes = $avgStmt->fetch(PDO::FETCH_ASSOC);
                $newAvg = $avgRes['avg_rating'] !== null ? round((float)$avgRes['avg_rating'], 1) : 0;

                $updateProduct = $pdo->prepare("UPDATE products SET rating = ? WHERE id = ?");
                $updateProduct->execute([$newAvg, $productId]);
                
                $pdo->commit();
            }

            logger('warning', 'REVIEWS', "Review #{$id} deleted by admin {$userName}");
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
