<?php
// backend/reviews.php
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

// --- Self-healing Schema ---
if ($config['DB_AUTO_REPAIR'] ?? false) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS product_reviews (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            product_id INT NOT NULL,
            rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            UNIQUE KEY unique_user_product (user_id, product_id)
        )");
    } catch (Exception $e) {
        error_log("Reviews schema self-healing failed: " . $e->getMessage());
    }
}

// GET: Fetch reviews for a product
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $productId = (int)($_GET['product_id'] ?? 0);

    if ($productId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'product_id is required']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("
            SELECT r.id, r.rating, r.comment, r.created_at, 
                   u.name as user_name, u.avatar_text
            FROM product_reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.product_id = ?
            ORDER BY r.created_at DESC
        ");
        $stmt->execute([$productId]);
        $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Calculate average rating
        $avgStmt = $pdo->prepare("SELECT AVG(rating) as avg_rating, COUNT(*) as total FROM product_reviews WHERE product_id = ?");
        $avgStmt->execute([$productId]);
        $stats = $avgStmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => [
                'reviews' => $reviews,
                'average_rating' => round((float)($stats['avg_rating'] ?? 0), 1),
                'total_reviews' => (int)($stats['total'] ?? 0)
            ]
        ]);
    } catch (Exception $e) {
        error_log("Reviews fetch error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to fetch reviews']);
    }
    exit;
}

// POST: Submit a review
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $userId = authenticate($pdo);

    $content = trim(file_get_contents("php://input"));
    $decoded = json_decode($content, true);

    $productId = (int)($decoded['product_id'] ?? 0);
    $rating = (int)($decoded['rating'] ?? 0);
    $comment = sanitizeInput($decoded['comment'] ?? '');

    if ($productId <= 0 || $rating < 1 || $rating > 5) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Valid product_id and rating (1-5) are required']);
        exit;
    }

    try {
        // Verify user has purchased this product
        $purchaseCheck = $pdo->prepare("
            SELECT COUNT(*) as purchased FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.user_id = ? AND oi.product_id = ? AND o.status IN ('processing', 'shipped', 'delivered')
        ");
        $purchaseCheck->execute([$userId, $productId]);
        $hasPurchased = $purchaseCheck->fetch(PDO::FETCH_ASSOC)['purchased'] > 0;

        if (!$hasPurchased) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'You can only review products you have purchased']);
            exit;
        }

        // Check if user already reviewed this product
        $existingCheck = $pdo->prepare("SELECT id FROM product_reviews WHERE user_id = ? AND product_id = ?");
        $existingCheck->execute([$userId, $productId]);

        if ($existingCheck->fetch()) {
            // Update existing review
            $stmt = $pdo->prepare("UPDATE product_reviews SET rating = ?, comment = ?, created_at = NOW() WHERE user_id = ? AND product_id = ?");
            $stmt->execute([$rating, $comment, $userId, $productId]);
        } else {
            // Insert new review
            $stmt = $pdo->prepare("INSERT INTO product_reviews (user_id, product_id, rating, comment) VALUES (?, ?, ?, ?)");
            $stmt->execute([$userId, $productId, $rating, $comment]);
        }

        // Update the product's average rating with row locking to prevent race conditions
        $pdo->beginTransaction();
        
        $lockStmt = $pdo->prepare("SELECT rating FROM products WHERE id = ? FOR UPDATE");
        $lockStmt->execute([$productId]);
        
        $avgStmt = $pdo->prepare("SELECT AVG(rating) as avg_rating FROM product_reviews WHERE product_id = ?");
        $avgStmt->execute([$productId]);
        $newAvg = round((float)$avgStmt->fetch(PDO::FETCH_ASSOC)['avg_rating'], 1);

        $updateProduct = $pdo->prepare("UPDATE products SET rating = ? WHERE id = ?");
        $updateProduct->execute([$newAvg, $productId]);
        
        $pdo->commit();

        $userName = getUserName($userId, $pdo);
        logger('ok', 'REVIEWS', "User {$userName} reviewed product #{$productId} with {$rating} stars");

        echo json_encode(['success' => true, 'message' => 'Review submitted successfully', 'new_average' => $newAvg]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log("Review submission error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to submit review']);
    }
    exit;
}
