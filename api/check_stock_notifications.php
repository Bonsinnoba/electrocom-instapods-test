<?php
/**
 * Stock Notification Checker
 * This script should be run periodically (e.g., via cron job) to check for products
 * that are back in stock and send notifications to users who requested them.
 *
 * Usage: php api/check_stock_notifications.php
 */

require_once 'config.php';
require_once 'email_engine.php';

try {
    $pdo = getPDO();

    // Get all pending stock notifications for products that are now in stock
    $stmt = $pdo->prepare("
        SELECT DISTINCT sn.*, p.name as product_name, p.image as product_image, p.stock_quantity, p.status
        FROM stock_notifications sn
        JOIN products p ON sn.product_id = p.id
        WHERE sn.status = 'pending'
        AND (p.status != 'out_of_stock' AND (p.stock_quantity IS NULL OR p.stock_quantity > 0))
    ");
    $stmt->execute();
    $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($notifications)) {
        echo "No pending notifications to process.\n";
        exit(0);
    }

    $emailEngine = new EmailEngine();
    $sentCount = 0;
    $failedCount = 0;

    foreach ($notifications as $notification) {
        try {
            // Send email notification
            if ($notification['notification_method'] === 'email' || $notification['notification_method'] === 'both') {
                $emailSent = $emailEngine->sendEmail(
                    $notification['email'],
                    'Product Back in Stock: ' . $notification['product_name'],
                    'stock_notification',
                    [
                        'product_name' => $notification['product_name'],
                        'product_image' => $notification['product_image'],
                        'user_name' => '',
                        'notification_date' => date('Y-m-d H:i:s')
                    ]
                );

                if (!$emailSent) {
                    throw new Exception('Failed to send email');
                }
            }

            // Send SMS notification (if SMS gateway is configured)
            if ($notification['notification_method'] === 'sms' || $notification['notification_method'] === 'both') {
                if ($notification['phone']) {
                    // TODO: Implement SMS gateway integration
                    // This would use an SMS service like Twilio, Africa's Talking, etc.
                    // For now, we'll log it
                    error_log("SMS notification would be sent to {$notification['phone']} for product {$notification['product_name']}");
                }
            }

            // Create in-app notification
            $notifStmt = $pdo->prepare("
                INSERT INTO notifications (user_id, type, title, message, data, created_at)
                VALUES (?, 'stock_alert', ?, ?, ?, NOW())
            ");
            $notifStmt->execute([
                $notification['user_id'],
                'Product Back in Stock',
                "Great news! {$notification['product_name']} is now back in stock.",
                json_encode([
                    'product_id' => $notification['product_id'],
                    'product_name' => $notification['product_name'],
                    'product_image' => $notification['product_image']
                ])
            ]);

            // Update notification status to sent
            $updateStmt = $pdo->prepare("UPDATE stock_notifications SET status = 'sent', sent_at = NOW() WHERE id = ?");
            $updateStmt->execute([$notification['id']]);

            $sentCount++;
            echo "✓ Sent notification to {$notification['email']} for {$notification['product_name']}\n";

        } catch (Exception $e) {
            $failedCount++;
            error_log("Failed to send notification for product {$notification['product_name']}: " . $e->getMessage());
            echo "✗ Failed to send notification to {$notification['email']} for {$notification['product_name']}\n";
        }
    }

    echo "\nSummary: {$sentCount} notifications sent, {$failedCount} failed\n";

} catch (PDOException $e) {
    error_log("Stock notification checker error: " . $e->getMessage());
    echo "Database error: " . $e->getMessage() . "\n";
    exit(1);
}
