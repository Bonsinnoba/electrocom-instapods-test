<?php
// api/admin_shipments.php
// Create and manage shipments for orders - both self-fleet and carrier.
// Self-fleet creation goes through SelfFleetProvider (zone matching, rate).
// Carrier creation is recorded manually here for now, since
// CarrierProviderStub has no live API integration yet (see that file) -
// staff can log a tracking number they generated on the carrier's own
// site/portal until a real adapter replaces the stub.
require_once 'cors_middleware.php';
require_once 'db.php';
require_once 'security.php';
require_once __DIR__ . '/order_utils.php'; // logOrderEvent()
require_once __DIR__ . '/shipping/ShippingProviderFactory.php';

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
    $id = validateInt($_GET['id'] ?? null);

    if ($id) {
        $stmt = $pdo->prepare("
            SELECT s.*, o.user_id AS order_user_id, z.name AS zone_name, r.name AS rider_name, r.phone AS rider_phone
            FROM shipments s
            JOIN orders o ON s.order_id = o.id
            LEFT JOIN shipping_zones z ON s.zone_id = z.id
            LEFT JOIN riders r ON s.rider_id = r.id
            WHERE s.id = ?
        ");
        $stmt->execute([$id]);
        $shipment = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$shipment) sendResponse(false, 'Shipment not found', null, 404);
        sendResponse(true, 'Shipment fetched', $shipment);
    }

    $status = $_GET['status'] ?? null;
    $params = [];
    $sql = "
        SELECT s.*, z.name AS zone_name, r.name AS rider_name
        FROM shipments s
        LEFT JOIN shipping_zones z ON s.zone_id = z.id
        LEFT JOIN riders r ON s.rider_id = r.id
    ";
    if ($status) {
        $sql .= " WHERE s.status = ?";
        $params[] = sanitizeInput($status);
    }
    $sql .= " ORDER BY s.created_at DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    sendResponse(true, 'Shipments fetched', $stmt->fetchAll(PDO::FETCH_ASSOC));
}

$payload = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $payload['action'] ?? '';

try {
    // Create a self-fleet shipment for an order using the zone-matching
    // logic in SelfFleetProvider, so this stays in sync with checkout rates.
    if ($action === 'create_self_fleet') {
        $orderId = validateInt($payload['order_id'] ?? null, 1);
        $destLat = validateFloat($payload['dest_lat'] ?? null);
        $destLng = validateFloat($payload['dest_lng'] ?? null);
        $destRegion = sanitizeInput($payload['dest_region'] ?? '');
        $destAddress = sanitizeInput($payload['dest_address'] ?? '');

        if (!$orderId) sendResponse(false, 'Valid order_id is required', null, 400);

        $existsStmt = $pdo->prepare("SELECT COUNT(*) FROM shipments WHERE order_id = ?");
        $existsStmt->execute([$orderId]);
        if ($existsStmt->fetchColumn() > 0) {
            sendResponse(false, 'A shipment already exists for this order', null, 400);
        }

        $orderStmt = $pdo->prepare("SELECT total_amount FROM orders WHERE id = ?");
        $orderStmt->execute([$orderId]);
        $order = $orderStmt->fetch(PDO::FETCH_ASSOC);
        if (!$order) sendResponse(false, 'Order not found', null, 404);

        $provider = new SelfFleetProvider($pdo);
        $destination = ['lat' => $destLat, 'lng' => $destLng, 'region' => $destRegion, 'address' => $destAddress];
        $result = $provider->createShipment($orderId, [], $destination, ['subtotal' => $order['total_amount']]);

        sendResponse(true, 'Self-fleet shipment created', $result);
    }

    // Record a carrier shipment manually (see file header note above).
    if ($action === 'create_carrier') {
        $orderId = validateInt($payload['order_id'] ?? null, 1);
        $carrierName = sanitizeInput($payload['carrier_name'] ?? '');
        $trackingNumber = sanitizeInput($payload['tracking_number'] ?? '');
        $cost = validateFloat($payload['cost'] ?? 0, 0) ?? 0;
        $destAddress = sanitizeInput($payload['dest_address'] ?? '');

        if (!$orderId || $carrierName === '') {
            sendResponse(false, 'Order id and carrier name are required', null, 400);
        }

        $stmt = $pdo->prepare("
            INSERT INTO shipments (order_id, provider_type, carrier_name, tracking_number, status, cost, destination_address)
            VALUES (?, 'carrier', ?, ?, 'pending', ?, ?)
        ");
        $stmt->execute([$orderId, $carrierName, $trackingNumber ?: null, $cost, $destAddress]);
        $shipmentId = (int)$pdo->lastInsertId();

        logOrderEvent($orderId, 'shipment_created', "Carrier shipment created via {$carrierName}" . ($trackingNumber ? " ({$trackingNumber})" : ''), $pdo);

        sendResponse(true, 'Carrier shipment recorded', ['shipment_id' => $shipmentId]);
    }

    if ($action === 'assign_rider') {
        $id = validateInt($payload['id'] ?? null, 1);
        $riderId = validateInt($payload['rider_id'] ?? null, 1);

        if (!$id || !$riderId) sendResponse(false, 'Valid shipment id and rider id are required', null, 400);

        $riderStmt = $pdo->prepare("SELECT status FROM riders WHERE id = ?");
        $riderStmt->execute([$riderId]);
        $riderStatus = $riderStmt->fetchColumn();
        if ($riderStatus === false) sendResponse(false, 'Rider not found', null, 404);

        $pdo->prepare("UPDATE shipments SET rider_id = ?, status = 'assigned' WHERE id = ?")->execute([$riderId, $id]);
        $pdo->prepare("UPDATE riders SET status = 'on_delivery' WHERE id = ?")->execute([$riderId]);

        $orderIdStmt = $pdo->prepare("SELECT order_id FROM shipments WHERE id = ?");
        $orderIdStmt->execute([$id]);
        $orderId = $orderIdStmt->fetchColumn();
        logOrderEvent($orderId, 'rider_assigned', "Rider assigned to shipment #{$id}", $pdo);

        sendResponse(true, 'Rider assigned');
    }

    if ($action === 'update_status') {
        $id = validateInt($payload['id'] ?? null, 1);
        $status = sanitizeInput($payload['status'] ?? '');
        $validStatuses = ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'cancelled'];

        if (!$id || !in_array($status, $validStatuses, true)) {
            sendResponse(false, 'Valid shipment id and status are required', null, 400);
        }

        $stmt = $pdo->prepare("SELECT order_id, rider_id FROM shipments WHERE id = ?");
        $stmt->execute([$id]);
        $shipment = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$shipment) sendResponse(false, 'Shipment not found', null, 404);

        if ($status === 'delivered') {
            $pdo->prepare("UPDATE shipments SET status = ?, delivered_at = NOW() WHERE id = ?")->execute([$status, $id]);
            if ($shipment['rider_id']) {
                $pdo->prepare("UPDATE riders SET status = 'available' WHERE id = ?")->execute([$shipment['rider_id']]);
            }
        } else {
            $pdo->prepare("UPDATE shipments SET status = ? WHERE id = ?")->execute([$status, $id]);
        }

        logOrderEvent($shipment['order_id'], 'shipment_' . $status, "Shipment #{$id} status changed to {$status}", $pdo);
        sendResponse(true, 'Shipment status updated');
    }

    sendResponse(false, 'Invalid action', null, 400);
} catch (Exception $e) {
    error_log('admin_shipments error: ' . $e->getMessage());
    sendResponse(false, 'Request failed', null, 500);
}
