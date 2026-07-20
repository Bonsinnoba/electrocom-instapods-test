<?php
header('Content-Type: application/json');
require_once 'db.php';

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON input']);
    exit;
}

$id = intval($input['id'] ?? 0);

if ($id === 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Category ID is required']);
    exit;
}

try {
    $pdo->beginTransaction();

    // Check if category exists
    $checkStmt = $pdo->prepare("SELECT id, name FROM categories WHERE id = ?");
    $checkStmt->execute([$id]);
    $category = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if (!$category) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Category not found']);
        exit;
    }

    // Check if category is being used by any products
    $productCheckStmt = $pdo->prepare("SELECT COUNT(*) as count FROM products WHERE category = ?");
    $productCheckStmt->execute([$category['name']]);
    $productCount = $productCheckStmt->fetch(PDO::FETCH_ASSOC)['count'];

    if ($productCount > 0) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'error' => "Cannot delete category '{$category['name']}' because it is being used by {$productCount} product(s). Please reassign or delete those products first."
        ]);
        exit;
    }

    // Delete the category
    $deleteStmt = $pdo->prepare("DELETE FROM categories WHERE id = ?");
    $deleteStmt->execute([$id]);

    $pdo->commit();

    echo json_encode(['success' => true, 'data' => ['id' => $id, 'name' => $category['name']]]);
} catch (PDOException $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
