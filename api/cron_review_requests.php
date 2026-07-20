<?php
// backend/cron_review_requests.php
// This script sends automated review requests for delivered orders.
// Should be run via cron (e.g., once daily or every few hours).

require_once 'db.php';
require_once 'notifications.php';
require_once __DIR__ . '/brand_settings.php';

$output = [];
$output[] = "Starting Automated Review Request Scan - " . date('Y-m-d H:i:s');

try {
    $notifier = new NotificationService();

    // Fetch orders that are 'delivered' and haven't had a review request sent yet.
    // We wait for at least 24 hours after delivery to ensure the customer has the product.
    $query = "
        SELECT o.id, o.user_id, u.name, u.email, o.updated_at
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE (o.status = 'delivered' OR o.status = 'Delivered')
          AND o.review_requested_at IS NULL
          AND o.updated_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
    ";

    $stmt = $pdo->prepare($query);
    $stmt->execute();
    $ordersToRequest = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $requestsSent = 0;

    foreach ($ordersToRequest as $order) {
        // Get items for this order to personalize the email
        $itemStmt = $pdo->prepare("
            SELECT p.name 
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        ");
        $itemStmt->execute([$order['id']]);
        $items = $itemStmt->fetchAll(PDO::FETCH_COLUMN);

        $itemsStr = implode(", ", $items);
        if (strlen($itemsStr) > 100) {
            $itemsStr = substr($itemsStr, 0, 97) . "...";
        }

        $subject = "How is your new tech? 🌟 Review your order ORD-{$order['id']}";
        $message = "Hi {$order['name']},\n\n";
        $message .= "Your recent order (ORD-{$order['id']}) was delivered recently. We hope you're loving your new {$itemsStr}!\n\n";
        $frontendUrl = $notifier->config['FRONTEND_URL'] ?? 'http://localhost:5173';
        $message .= "Could you take a minute to tell us what you think? Your feedback helps other shoppers and helps us improve.\n\n";
        $message .= "Review your items here: {$frontendUrl}/orders\n\n";
        $message .= "As a thank you for your feedback, you'll be entered into our monthly giveaway!\n\n";
        $message .= "Best regards,\nThe " . eh_brand_site_name() . " Team";

        // Send Email
        try {
            if ($notifier->queueNotification('email', $order['email'], $message, $subject)) {
                $requestsSent++;
                // Mark as sent
                $updateStmt = $pdo->prepare("UPDATE orders SET review_requested_at = NOW() WHERE id = ?");
                $updateStmt->execute([$order['id']]);

                logger('info', 'ORDERS', "Review request sent to {$order['email']} for order #{$order['id']}");
            }
        } catch (Exception $e) {
            $output[] = "Failed to send email to {$order['email']}: " . $e->getMessage();
        }
    }

    $output[] = "Sent $requestsSent review request emails.";
} catch (Exception $e) {
    $output[] = "Error during execution: " . $e->getMessage();
    error_log("Cron review requests error: " . $e->getMessage());
}

$output[] = "Finished execution - " . date('Y-m-d H:i:s');

// If accessed via web browser, print output cleanly
if (php_sapi_name() !== 'cli') {
    echo "<pre>" . implode("\n", $output) . "</pre>";
} else {
    echo implode("\n", $output) . "\n";
}
