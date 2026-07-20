<?php
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

$userId = authenticate($pdo);
if (!$userId) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

try {
    // Fetch successful payments (with payment_reference) from orders
    // We only show orders that have been paid (payment_method not empty)
    $stmt = $pdo->prepare("
        SELECT 
            id, 
            total_amount as amount, 
            payment_method as method, 
            payment_reference as reference, 
            status, 
            created_at as date 
        FROM orders 
        WHERE user_id = ? AND payment_method IS NOT NULL
        ORDER BY created_at DESC
    ");
    $stmt->execute([$userId]);
    $transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Format for frontend
    $formatted = array_map(function($t) {
        return [
            'id' => $t['id'],
            'amount' => (float)$t['amount'],
            'method' => $t['method'],
            'reference' => $t['reference'] ?: 'N/A',
            'status' => $t['status'],
            'date' => $t['date'],
            'title' => 'Order Payment: #' . $t['id'],
            'type' => 'debit' // Since it's a payment outgoing from user
        ];
    }, $transactions);

    echo json_encode(['success' => true, 'data' => $formatted]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
