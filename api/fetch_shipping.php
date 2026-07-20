<?php
// api/fetch_shipping.php
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $content = trim(file_get_contents("php://input"));
    $decoded = json_decode($content, true);

    if (!is_array($decoded)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON payload']);
        exit;
    }

    $region = sanitizeInput($decoded['region'] ?? '');
    $subtotal = (float)($decoded['subtotal'] ?? 0);

    if (empty($region)) {
        echo json_encode(['success' => false, 'message' => 'Region is required', 'fee' => 0]);
        exit;
    }

    try {
        // Use existing logic from security.php
        $shippingInfo = calculateRegionalShipping($region, $subtotal, $pdo);

        echo json_encode([
            'success' => true,
            'fee' => $shippingInfo['fee'],
            'city' => $shippingInfo['city'],
            'is_discounted' => $subtotal >= 1500
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to calculate shipping']);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
