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

$name = trim($input['name'] ?? '');
$slug = trim($input['slug'] ?? '');
$description = trim($input['description'] ?? '');
$icon = trim($input['icon'] ?? '');
$displayOrder = intval($input['display_order'] ?? 0);
$isActive = isset($input['is_active']) ? ($input['is_active'] ? 1 : 0) : 1;

if (empty($name)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Category name is required']);
    exit;
}

// Generate slug from name if not provided
if (empty($slug)) {
    $slug = strtolower(preg_replace('/[^a-z0-9]+/', '-', $name));
}

try {
    $pdo->beginTransaction();

    // Check if name or slug already exists
    $checkStmt = $pdo->prepare("SELECT id FROM categories WHERE name = ? OR slug = ?");
    $checkStmt->execute([$name, $slug]);
    if ($checkStmt->fetch()) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Category with this name or slug already exists']);
        exit;
    }

    // Get the highest display_order and increment
    if ($displayOrder === 0) {
        $orderStmt = $pdo->query("SELECT COALESCE(MAX(display_order), 0) as max_order FROM categories");
        $maxOrder = $orderStmt->fetch(PDO::FETCH_ASSOC)['max_order'];
        $displayOrder = $maxOrder + 1;
    }

    // Insert new category
    $stmt = $pdo->prepare("INSERT INTO categories (name, slug, description, icon, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$name, $slug, $description, $icon, $displayOrder, $isActive]);

    $categoryId = $pdo->lastInsertId();
    $pdo->commit();

    echo json_encode(['success' => true, 'data' => ['id' => $categoryId, 'name' => $name, 'slug' => $slug]]);
} catch (PDOException $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
