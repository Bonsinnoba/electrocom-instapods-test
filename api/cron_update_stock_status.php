<?php
/**
 * api/cron_update_stock_status.php
 * Automated hourly task to sync product visibility with stock levels.
 */

require_once 'db.php';
require_once 'security.php';

// Prevent concurrent cron runs using file-based lock
$lockFile = __DIR__ . '/.cron_stock_status.lock';
$lockHandle = fopen($lockFile, 'w');

if (!flock($lockHandle, LOCK_EX | LOCK_NB)) {
    echo "Cron already running. Exiting.\n";
    exit(1);
}

try {
    // 1. Find items that just went out of stock
    $stmt = $pdo->query("SELECT id, name FROM products WHERE stock_quantity <= 0 AND status = 'active'");
    $justOutOfStock = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!empty($justOutOfStock)) {
        foreach ($justOutOfStock as $p) {
            $pdo->prepare("UPDATE products SET status = 'out_of_stock' WHERE id = ?")->execute([$p['id']]);
            logAdminAudit($pdo, 0, 'product.auto_out_of_stock', 'product', $p['id'], ['status' => 'out_of_stock', 'reason' => 'Zero stock detected by system']);
        }
    }

    // 2. Find items that were replenished
    $stmt = $pdo->query("SELECT id, name FROM products WHERE stock_quantity > 0 AND status = 'out_of_stock'");
    $justReplenished = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!empty($justReplenished)) {
        foreach ($justReplenished as $p) {
            $pdo->prepare("UPDATE products SET status = 'active' WHERE id = ?")->execute([$p['id']]);
            logAdminAudit($pdo, 0, 'product.auto_active', 'product', $p['id'], ['status' => 'active', 'reason' => 'Restock detected by system']);
        }
    }

    // 3. Alert if an archived product suddenly has stock
    $stmt = $pdo->query("SELECT id, name, stock_quantity FROM products WHERE stock_quantity > 0 AND status = 'archived'");
    $archivedWithStock = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!empty($archivedWithStock)) {
        require_once 'notifications.php';
        $notifService = new NotificationService();
        $count = count($archivedWithStock);
        $names = implode(', ', array_map(function($p) { return $p['name']; }, array_slice($archivedWithStock, 0, 3)));
        if ($count > 3) $names .= " and " . ($count - 3) . " more";
        
        $notifService->logAdminNotification(
            "Anomaly: Restocked Archived Items", 
            "$count archived product(s) currently have physical stock (e.g., $names). Please review and either remove the stock or unarchive the item.", 
            "inventory"
        );
    }

    echo "Sync Complete: " . count($justOutOfStock) . " marked out-of-stock, " . count($justReplenished) . " marked active. Anomalies: " . count($archivedWithStock) . "\n";

} catch (Exception $e) {
    error_log("Stock Sync Cron Error: " . $e->getMessage());
    echo "Sync Failed.\n";
} finally {
    // Release lock
    flock($lockHandle, LOCK_UN);
    fclose($lockHandle);
}
