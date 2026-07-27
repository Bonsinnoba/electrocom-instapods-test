<?php
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

try {
    // 1. Authenticate User
    $userId = authenticate($pdo);

    // 2. Get Input Data
    $data = json_decode(file_get_contents("php://input"), true);

    if (!isset($data['reference'])) {
        sendResponse(false, 'Missing payment reference', null, 400);
    }

    $reference = sanitizeInput($data['reference']);
    $type = isset($data['type']) ? sanitizeInput($data['type']) : 'order_payment'; // 'order_payment'

    // 3. Verify with Paystack
    $secretKey = $config['PAYSTACK_SECRET'] ?? "";

    if (!$secretKey) {
        throw new Exception("Paystack Secret Key is missing in environment.");
    }

    $url = "https://api.paystack.co/transaction/verify/" . rawurlencode($reference);

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer " . $secretKey,
        "Cache-Control: no-cache",
    ]);

    $result = curl_exec($ch);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        throw new Exception("cURL Error: " . $error);
    }

    $response = json_decode($result, true);

    if (!$response || !isset($response['status']) || !$response['status']) {
        sendResponse(false, 'Verification failed at gateway', null, 400);
    }

    if ($response['data']['status'] !== 'success') {
        sendResponse(false, 'Transaction was not successful: ' . $response['data']['gateway_response'], null, 400);
    }



    // Check orders
    $stmt = $pdo->prepare("SELECT id FROM orders WHERE payment_reference = ?");
    $stmt->execute([$reference]);
    if ($stmt->fetch()) {
        sendResponse(false, 'Transaction reference already used', null, 409);
    }

    // 5. Process Value
    $amountPaid = $response['data']['amount'] / 100; // Paystack returns kobo

    $pdo->beginTransaction();

    if ($type === 'order_payment') {
        // order_id is required — this endpoint completes a specific order,
        // and a specific order must be verified as belonging to the caller
        // and matching the amount actually paid before we touch it.
        if (!isset($data['order_id'])) {
            throw new Exception("order_id is required.");
        }

        $orderId = (int)$data['order_id'];

        // Lock and fetch the order to check ownership + amount before completing.
        $orderStmt = $pdo->prepare("SELECT id, user_id, total_amount, status, payment_reference FROM orders WHERE id = ? FOR UPDATE");
        $orderStmt->execute([$orderId]);
        $order = $orderStmt->fetch(PDO::FETCH_ASSOC);

        if (!$order) {
            throw new Exception("Order #{$orderId} not found.");
        }

        // Ownership check: a payment reference can only complete the order
        // belonging to the authenticated caller, never an arbitrary order_id.
        if ((int)$order['user_id'] !== (int)$userId) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'This order does not belong to you.']);
            $pdo->rollBack();
            exit;
        }

        // Amount check: the amount actually paid at the gateway must match
        // this order's total (within a small rounding tolerance), or a cheap
        // payment reference could be used to complete an unrelated, more
        // expensive order.
        $expectedTotal = (float)$order['total_amount'];
        if (abs($amountPaid - $expectedTotal) > 0.10) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => "Payment amount mismatch. Expected GHS {$expectedTotal}, paid GHS {$amountPaid}."
            ]);
            $pdo->rollBack();
            exit;
        }

        // Reconcile the order's payment_reference with the actual verified
        // reference (needed so refunds can later locate the real gateway transaction).
        if ($order['payment_reference'] !== $reference) {
            $pdo->prepare("UPDATE orders SET payment_reference = ? WHERE id = ?")->execute([$reference, $orderId]);
        }

        require_once 'order_utils.php';
        completeOrder($orderId, $pdo);
        $message = "Order verification complete";
    } else {
        throw new Exception("Invalid transaction type.");
    }

    $pdo->commit();

    sendResponse(true, $message, [
        'amount' => $amountPaid,
        'reference' => $reference
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Verification error: ' . $e->getMessage()]);
}


