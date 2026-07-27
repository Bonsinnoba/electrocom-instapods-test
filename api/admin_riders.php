<?php
// api/admin_riders.php
// CRUD + status/location updates for the self-owned delivery fleet.
require_once 'cors_middleware.php';
require_once 'db.php';
require_once 'security.php';

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

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("
        SELECT r.*, z.name AS zone_name,
               (SELECT COUNT(*) FROM shipments s WHERE s.rider_id = r.id AND s.status NOT IN ('delivered', 'cancelled', 'failed')) AS active_shipments
        FROM riders r
        LEFT JOIN shipping_zones z ON r.default_zone_id = z.id
        ORDER BY r.status = 'available' DESC, r.name ASC
    ");
    sendResponse(true, 'Riders fetched', $stmt->fetchAll(PDO::FETCH_ASSOC));
}

$payload = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $payload['action'] ?? '';

try {
    if ($action === 'create' || $action === 'update') {
        $id = validateInt($payload['id'] ?? null);
        $name = sanitizeInput($payload['name'] ?? '');
        $phone = sanitizeInput($payload['phone'] ?? '');
        $vehicleType = sanitizeInput($payload['vehicle_type'] ?? 'motorcycle');
        $defaultZoneId = validateInt($payload['default_zone_id'] ?? null);

        $validVehicles = ['bike', 'motorcycle', 'car', 'van'];
        if (!in_array($vehicleType, $validVehicles, true)) $vehicleType = 'motorcycle';

        if ($name === '' || $phone === '') {
            sendResponse(false, 'Rider name and phone are required', null, 400);
        }

        if ($action === 'create') {
            $stmt = $pdo->prepare("INSERT INTO riders (name, phone, vehicle_type, default_zone_id, status) VALUES (?, ?, ?, ?, 'offline')");
            $stmt->execute([$name, $phone, $vehicleType, $defaultZoneId]);
            sendResponse(true, 'Rider added', ['id' => (int)$pdo->lastInsertId()]);
        } else {
            if (!$id) sendResponse(false, 'Valid id is required for update', null, 400);
            $stmt = $pdo->prepare("UPDATE riders SET name = ?, phone = ?, vehicle_type = ?, default_zone_id = ? WHERE id = ?");
            $stmt->execute([$name, $phone, $vehicleType, $defaultZoneId, $id]);
            sendResponse(true, 'Rider updated');
        }
    }

    if ($action === 'set_status') {
        $id = validateInt($payload['id'] ?? null, 1);
        $status = sanitizeInput($payload['status'] ?? '');
        $validStatuses = ['available', 'on_delivery', 'offline'];

        if (!$id || !in_array($status, $validStatuses, true)) {
            sendResponse(false, 'Valid id and status are required', null, 400);
        }

        $pdo->prepare("UPDATE riders SET status = ? WHERE id = ?")->execute([$status, $id]);
        sendResponse(true, 'Rider status updated');
    }

    // Manual location entry for now (a rider-facing mobile view could call
    // this same action with GPS coordinates once one exists).
    if ($action === 'update_location') {
        $id = validateInt($payload['id'] ?? null, 1);
        $lat = validateFloat($payload['lat'] ?? null);
        $lng = validateFloat($payload['lng'] ?? null);

        if (!$id || $lat === null || $lng === null) {
            sendResponse(false, 'Valid id, lat, and lng are required', null, 400);
        }

        $pdo->prepare("UPDATE riders SET current_lat = ?, current_lng = ?, last_location_update = NOW() WHERE id = ?")
            ->execute([$lat, $lng, $id]);
        sendResponse(true, 'Rider location updated');
    }

    if ($action === 'delete') {
        $id = validateInt($payload['id'] ?? null, 1);
        if (!$id) sendResponse(false, 'Valid id is required', null, 400);

        $activeStmt = $pdo->prepare("SELECT COUNT(*) FROM shipments WHERE rider_id = ? AND status NOT IN ('delivered', 'cancelled', 'failed')");
        $activeStmt->execute([$id]);
        if ($activeStmt->fetchColumn() > 0) {
            sendResponse(false, 'This rider has active shipments and cannot be deleted. Reassign or complete them first.', null, 400);
        }

        $pdo->prepare("DELETE FROM riders WHERE id = ?")->execute([$id]);
        sendResponse(true, 'Rider deleted');
    }

    sendResponse(false, 'Invalid action', null, 400);
} catch (Exception $e) {
    error_log('admin_riders error: ' . $e->getMessage());
    sendResponse(false, 'Request failed', null, 500);
}
