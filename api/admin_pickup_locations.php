<?php
require_once 'cors_middleware.php';
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

try {
    $userId = authenticate($pdo);
    requireRole(['super'], $pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
}

// Self-heal table for environments that missed migrations.
$pdo->exec("CREATE TABLE IF NOT EXISTS pickup_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) DEFAULT NULL,
    fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)");

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM pickup_locations ORDER BY created_at DESC");
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $payload['action'] ?? '';

try {
    if ($action === 'create') {
        $name = sanitizeInput($payload['name'] ?? '');
        $address = sanitizeInput($payload['address'] ?? '');
        $city = sanitizeInput($payload['city'] ?? '');
        $fee = (float)($payload['fee'] ?? 0);
        if ($name === '' || $address === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Name and address are required']);
            exit;
        }
        if ($fee < 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Fee cannot be negative']);
            exit;
        }

        $stmt = $pdo->prepare("INSERT INTO pickup_locations (name, address, city, fee, is_active) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([
            $name,
            $address,
            $city,
            $fee,
            isset($payload['is_active']) ? (int)(bool)$payload['is_active'] : 1
        ]);
        echo json_encode(['success' => true]);
        exit;
    }

    if ($action === 'update') {
        $id = (int)($payload['id'] ?? 0);
        $name = sanitizeInput($payload['name'] ?? '');
        $address = sanitizeInput($payload['address'] ?? '');
        $city = sanitizeInput($payload['city'] ?? '');
        $fee = (float)($payload['fee'] ?? 0);
        if ($id <= 0 || $name === '' || $address === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Valid id, name and address are required']);
            exit;
        }
        if ($fee < 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Fee cannot be negative']);
            exit;
        }

        $stmt = $pdo->prepare("UPDATE pickup_locations SET name = ?, address = ?, city = ?, fee = ?, is_active = ? WHERE id = ?");
        $stmt->execute([
            $name,
            $address,
            $city,
            $fee,
            isset($payload['is_active']) ? (int)(bool)$payload['is_active'] : 1,
            $id
        ]);
        echo json_encode(['success' => true]);
        exit;
    }

    if ($action === 'delete') {
        $id = (int)($payload['id'] ?? 0);
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid location id']);
            exit;
        }

        $orderCols = $pdo->query("DESCRIBE orders")->fetchAll(PDO::FETCH_COLUMN);
        if (in_array('pickup_location_id', $orderCols, true)) {
            $check = $pdo->prepare("SELECT COUNT(*) FROM orders WHERE pickup_location_id = ?");
            $check->execute([$id]);
            if ((int)$check->fetchColumn() > 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Cannot delete location: already used by existing orders. Deactivate it instead.']);
                exit;
            }
        }

        $stmt = $pdo->prepare("DELETE FROM pickup_locations WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid action']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
