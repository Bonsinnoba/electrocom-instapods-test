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
$name = trim($input['name'] ?? '');
$slug = trim($input['slug'] ?? '');
$description = trim($input['description'] ?? '');
$icon = trim($input['icon'] ?? '');
$displayOrder = intval($input['display_order'] ?? 0);
$isActive = isset($input['is_active']) ? ($input['is_active'] ? 1 : 0) : null;

if ($id === 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Category ID is required']);
    exit;
}

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

    // Check if category exists
    $checkStmt = $pdo->prepare("SELECT id FROM categories WHERE id = ?");
    $checkStmt->execute([$id]);
    if (!$checkStmt->fetch()) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Category not found']);
        exit;
    }

    // Check if name or slug conflicts with another category
    $conflictStmt = $pdo->prepare("SELECT id FROM categories WHERE (name = ? OR slug = ?) AND id != ?");
    $conflictStmt->execute([$name, $slug, $id]);
    if ($conflictStmt->fetch()) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Category with this name or slug already exists']);
        exit;
    }

    // Build update query dynamically based on provided fields
    $updateFields = ['name = ?', 'slug = ?'];
    $params = [$name, $slug];

    if ($description !== '') {
        $updateFields[] = 'description = ?';
        $params[] = $description;
    }

    if ($icon !== '') {
        $updateFields[] = 'icon = ?';
        $params[] = $icon;
    }

    if ($displayOrder > 0) {
        $updateFields[] = 'display_order = ?';
        $params[] = $displayOrder;
    }

    if ($isActive !== null) {
        $updateFields[] = 'is_active = ?';
        $params[] = $isActive;
    }

    $params[] = $id;
    $updateFields[] = 'updated_at = CURRENT_TIMESTAMP';

    $sql = "UPDATE categories SET " . implode(', ', $updateFields) . " WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $pdo->commit();

    echo json_encode(['success' => true, 'data' => ['id' => $id, 'name' => $name, 'slug' => $slug]]);
} catch (PDOException $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
