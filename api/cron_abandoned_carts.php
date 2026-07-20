<?php
// backend/cron_abandoned_carts.php
// This script should be run via a cron job (e.g., every hour)
// For local testing, it can be run manually via browser or CLI

require_once 'db.php';
require_once 'notifications.php';
require_once __DIR__ . '/brand_settings.php';

$output = [];
$output[] = "Starting Abandoned Cart Recovery Scan - " . date('Y-m-d H:i:s');

try {
    $notifier = new NotificationService();

    // 1. Mark 'active' carts as 'abandoned' if untouched for > 2 hours
    // But haven't been abandoned for > 48 hours (to not resurface ancient carts)
    $markQuery = "
        UPDATE abandoned_carts 
        SET status = 'abandoned' 
        WHERE status = 'active' 
          AND last_updated < DATE_SUB(NOW(), INTERVAL 2 HOUR)
          AND last_updated > DATE_SUB(NOW(), INTERVAL 48 HOUR)
          AND JSON_LENGTH(cart_data) > 0
    ";
    $stmt = $pdo->prepare($markQuery);
    $stmt->execute();
    $markedRows = $stmt->rowCount();
    $output[] = "Marked $markedRows active carts as abandoned.";

    // 2. Fetch all newly abandoned carts to send emails
    // We only want to send ONE email per abandoned session, so we add an 'email_sent' flag
    // First, let's ensure the column exists (Self-healing schema)
    $stmt = $pdo->prepare("DESCRIBE abandoned_carts");
    $stmt->execute();
    $cols = $stmt->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('email_sent_at', $cols)) {
        $pdo->exec("ALTER TABLE abandoned_carts ADD COLUMN email_sent_at DATETIME DEFAULT NULL");
    }

    $fetchQuery = "
        SELECT a.id, a.cart_data, u.name, u.email
        FROM abandoned_carts a
        JOIN users u ON a.user_id = u.id
        WHERE a.status = 'abandoned'
          AND a.email_sent_at IS NULL
    ";

    $stmt = $pdo->prepare($fetchQuery);
    $stmt->execute();
    $cartsToRecover = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $emailsSent = 0;

    foreach ($cartsToRecover as $cart) {
        $decodedCart = json_decode($cart['cart_data'], true);

        if (empty($decodedCart)) {
            continue; // Skip if empty despite previous checks
        }

        // Generate email content
        $itemNames = array_map(function ($item) {
            return $item['name'] . " (x" . $item['quantity'] . ")";
        }, $decodedCart);

        $itemListStr = implode("\n- ", $itemNames);

        $subject = "You left something behind! 🛒";
        $message = "Hi {$cart['name']},\n\n";
        $message .= "We noticed you left some great items in your shopping cart at " . eh_brand_site_name() . ". ";
        $message .= "Your items are waiting for you, but stock is limited!\n\n";
        $frontendUrl = $notifier->config['FRONTEND_URL'] ?? 'http://localhost:5173';
        $message .= "Your Cart:\n- {$itemListStr}\n\n";
        $message .= "Click here to complete your checkout: {$frontendUrl}/cart\n\n";
        $message .= "We've also included a special 5% discount code to help you along: COMEBACK5\n\n";
        $message .= "Best regards,\nThe " . eh_brand_site_name() . " Team";

        // Send Email
        try {
            if ($notifier->queueNotification('email', $cart['email'], $message, $subject)) {
                $emailsSent++;
                // Mark as sent
                $updateStmt = $pdo->prepare("UPDATE abandoned_carts SET email_sent_at = NOW() WHERE id = ?");
                $updateStmt->execute([$cart['id']]);

                logger('info', 'ORDERS', "Abandoned cart email sent to {$cart['email']}");
            }
        } catch (Exception $e) {
            $output[] = "Failed to send email to {$cart['email']}: " . $e->getMessage();
        }
    }

    $output[] = "Sent $emailsSent recovery emails.";
} catch (Exception $e) {
    $output[] = "Error during execution: " . $e->getMessage();
    error_log("Cron abandoned carts error: " . $e->getMessage());
}

$output[] = "Finished execution - " . date('Y-m-d H:i:s');

// If accessed via web browser, print output cleanly
if (php_sapi_name() !== 'cli') {
    echo "<pre>" . implode("\n", $output) . "</pre>";
} else {
    echo implode("\n", $output) . "\n";
}
