<?php
// api/admin_shipping_zones.php
// CRUD for self-fleet delivery zones (radius-based).
require_once 'cors_middleware.php';
require_once 'db.php';
require_once 'security.php';
require_once __DIR__ . '/order_utils.php';

header('Content-Type: application/json');

try {
    $userId = requireRole(['store_manager'], $pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
}

if (in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PUT', 'DELETE'])) {
    $csrfToken = getCSRFTokenFromRequest();
    if (!validateCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired CSRF token.']);
        exit;
    }
}

ensure_institutional_and_delivery_tables($pdo);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM shipping_zones ORDER BY name ASC");
    sendResponse(true, 'Zones fetched', $stmt->fetchAll(PDO::FETCH_ASSOC));
}

$payload = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $payload['action'] ?? '';

try {
    if ($action === 'create' || $action === 'update') {
        $id = validateInt($payload['id'] ?? null);
        $name = sanitizeInput($payload['name'] ?? '');
        $region = sanitizeInput($payload['region'] ?? '');
        $centerLat = validateFloat($payload['center_lat'] ?? null);
        $centerLng = validateFloat($payload['center_lng'] ?? null);
        $radiusKm = validateFloat($payload['radius_km'] ?? null, 0);
        $baseFee = validateFloat($payload['base_fee'] ?? 0, 0) ?? 0;
        $perKmFee = validateFloat($payload['per_km_fee'] ?? 0, 0) ?? 0;
        $isActive = !empty($payload['is_active']);

        if ($name === '') {
            sendResponse(false, 'Zone name is required', null, 400);
        }

        if ($action === 'create') {
            $stmt = $pdo->prepare("
                INSERT INTO shipping_zones (name, region, center_lat, center_lng, radius_km, base_fee, per_km_fee, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$name, $region, $centerLat, $centerLng, $radiusKm, $baseFee, $perKmFee, $isActive ? 1 : 0]);
            sendResponse(true, 'Zone created', ['id' => (int)$pdo->lastInsertId()]);
        } else {
            if (!$id) sendResponse(false, 'Valid id is required for update', null, 400);
            $stmt = $pdo->prepare("
                UPDATE shipping_zones SET name = ?, region = ?, center_lat = ?, center_lng = ?, radius_km = ?, base_fee = ?, per_km_fee = ?, is_active = ?
                WHERE id = ?
            ");
            $stmt->execute([$name, $region, $centerLat, $centerLng, $radiusKm, $baseFee, $perKmFee, $isActive ? 1 : 0, $id]);
            sendResponse(true, 'Zone updated');
        }
    }

    if ($action === 'delete') {
        $id = validateInt($payload['id'] ?? null, 1);
        if (!$id) sendResponse(false, 'Valid id is required', null, 400);
        $pdo->prepare("UPDATE riders SET default_zone_id = NULL WHERE default_zone_id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM shipping_zones WHERE id = ?")->execute([$id]);
        sendResponse(true, 'Zone deleted');
    }

    sendResponse(false, 'Invalid action', null, 400);
} catch (Exception $e) {
    error_log('admin_shipping_zones error: ' . $e->getMessage());
    sendResponse(false, 'Request failed', null, 500);
}
