<?php
require_once 'db.php';
require_once 'config.php';
require_once 'notifications.php';
require_once 'security.php';
require_once __DIR__ . '/brand_settings.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Invalid method']);
    exit;
}

$headers = getallheaders();
$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
if (empty($authHeader)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$orderId = $input['order_id'] ?? '';
$email = $input['email'] ?? '';

if (!$orderId || !$email) {
    echo json_encode(['success' => false, 'error' => 'Missing order ID or email']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();

    if (!$order) {
        echo json_encode(['success' => false, 'error' => 'Order not found']);
        exit;
    }

    $itemStmt = $pdo->prepare("
        SELECT oi.*, p.name 
        FROM order_items oi 
        JOIN products p ON oi.product_id = p.id 
        WHERE oi.order_id = ?
    ");
    $itemStmt->execute([$orderId]);
    $items = $itemStmt->fetchAll();

    $siteName = htmlspecialchars(eh_brand_site_name(), ENT_QUOTES, 'UTF-8');

    $html = "<div style='font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;'>";
    $html .= "<h2 style='text-align: center;'>{$siteName}</h2>";
    $html .= "<p style='text-align: center; color: #666;'>Receipt for Order <strong>#ORD-{$orderId}</strong></p>";
    $html .= "<hr style='border: none; border-top: 1px solid #ddd; margin: 20px 0;'/>";
    
    $html .= "<p>Thank you for your purchase!</p>";
    $html .= "<table style='width: 100%; border-collapse: collapse; margin-top: 20px;'>";
    $html .= "<thead>";
    $html .= "<tr style='border-bottom: 2px solid #ddd;'>";
    $html .= "<th style='text-align: left; padding: 10px 5px;'>Item</th>";
    $html .= "<th style='text-align: center; padding: 10px 5px;'>Qty</th>";
    $html .= "<th style='text-align: right; padding: 10px 5px;'>Price</th>";
    $html .= "<th style='text-align: right; padding: 10px 5px;'>Total</th>";
    $html .= "</tr>";
    $html .= "</thead>";
    $html .= "<tbody>";
    
    foreach ($items as $item) {
        $lineTotal = $item['quantity'] * $item['price_at_purchase'];
        $html .= "<tr style='border-bottom: 1px solid #eee;'>";
        $html .= "<td style='padding: 10px 5px;'>{$item['name']}</td>";
        $html .= "<td style='text-align: center; padding: 10px 5px;'>{$item['quantity']}</td>";
        $html .= "<td style='text-align: right; padding: 10px 5px;'>GH₵ " . number_format($item['price_at_purchase'], 2) . "</td>";
        $html .= "<td style='text-align: right; padding: 10px 5px;'>GH₵ " . number_format($lineTotal, 2) . "</td>";
        $html .= "</tr>";
    }
    
    $html .= "</tbody>";
    $html .= "<tfoot>";
    $html .= "<tr>";
    $html .= "<th colspan='3' style='text-align: right; padding: 15px 5px; font-size: 16px;'>TOTAL</th>";
    $html .= "<th style='text-align: right; padding: 15px 5px; font-size: 16px; color: #1e3a8a;'>GH₵ " . number_format($order['total_amount'], 2) . "</th>";
    $html .= "</tr>";
    $html .= "</tfoot>";
    $html .= "</table>";
    
    $html .= "<div style='text-align: center; margin-top: 40px; font-size: 12px; color: #999;'>";
    $html .= "<p>Items may be returned within 14 days with original receipt.</p>";
    $html .= "</div>";
    $html .= "</div>";

    $notifier = new NotificationService();
    // Use queueNotification for consistency and to prevent POS delays
    // HTML content is preserved and sent by the cron job
    $success = $notifier->queueNotification('email', $email, $html, "Receipt for Order #ORD-{$orderId} from {$siteName}");

    echo json_encode(['success' => (bool)$success]);

} catch (Exception $e) {
    logger('error', 'EMAIL_RECEIPT', $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Server Configuration Error']);
}
