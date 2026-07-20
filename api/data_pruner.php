<?php
// api/data_pruner.php
// Data pruning and archiving system
// Run via: php /path/to/api/data_pruner.php --type=daily|weekly|monthly

require 'db.php';
require 'security.php';
require_once 'data_pruning_config.php';

// Parse command line arguments
$options = getopt('', ['type:', 'dry-run', 'force']);
$type = $options['type'] ?? 'daily';
$dryRun = isset($options['dry-run']);
$force = isset($options['force']);

$config = require 'data_pruning_config.php';

// Log file
$logFile = __DIR__ . '/logs/data_pruning.log';
if (!is_dir(dirname($logFile))) {
    mkdir(dirname($logFile), 0755, true);
}

/**
 * Log pruning activity
 */
function pruneLog($message) {
    global $logFile;
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[$timestamp] $message\n";
    file_put_contents($logFile, $logMessage, FILE_APPEND);
    echo $logMessage;
}

/**
 * Send alert email on pruning failure
 */
function sendPruneAlert($subject, $message) {
    global $config;
    $to = $config['ADMIN_EMAIL'] ?? 'admin@example.com';
    $from = $config['FROM_EMAIL'] ?? 'noreply@example.com';
    $appName = $config['APP_NAME'] ?? 'EssentialsHub';

    $body = "Data Pruning Alert - $appName\n";
    $body .= "============================\n\n";
    $body .= "Time: " . date('Y-m-d H:i:s') . "\n\n";
    $body .= "$message\n\n";
    $body .= "Please check the server and pruning configuration.\n";
    $body .= "Log file: " . __DIR__ . '/logs/data_pruning.log';

    $headers = "From: $from\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();

    @mail($to, "[$appName] $subject", $body, $headers);
    pruneLog("Alert email sent to: $to - $subject");
}

/**
 * Get records to prune based on retention policy
 */
function getRecordsToPrune($table, $dateColumn, $retentionDays, $pdo) {
    $cutoffDate = date('Y-m-d H:i:s', strtotime("-$retentionDays days"));
    
    $query = "SELECT COUNT(*) as count FROM `$table` WHERE `$dateColumn` < :cutoff";
    $stmt = $pdo->prepare($query);
    $stmt->execute(['cutoff' => $cutoffDate]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    return [
        'count' => $result['count'],
        'cutoff_date' => $cutoffDate
    ];
}

/**
 * Archive records before deletion
 */
function archiveRecords($table, $dateColumn, $cutoffDate, $pdo, $config) {
    if (!$config['archive']['enabled']) {
        return false;
    }

    $archiveDir = $config['archive']['location'];
    if (!is_dir($archiveDir)) {
        mkdir($archiveDir, 0755, true);
    }

    $archiveFile = $archiveDir . '/' . $table . '_' . date('Ymd_His') . '.json';
    
    // Fetch records to archive
    $query = "SELECT * FROM `$table` WHERE `$dateColumn` < :cutoff";
    $stmt = $pdo->prepare($query);
    $stmt->execute(['cutoff' => $cutoffDate]);
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($records)) {
        return false;
    }

    // Convert to JSON
    $jsonData = json_encode($records, JSON_PRETTY_PRINT);
    
    if ($config['archive']['compress']) {
        $jsonData = gzencode($jsonData, 9);
        $archiveFile .= '.gz';
    }
    
    $success = file_put_contents($archiveFile, $jsonData) !== false;
    
    if ($success) {
        pruneLog("Archived " . count($records) . " records from $table to $archiveFile");
    }
    
    return $success;
}

/**
 * Delete old records
 */
function deleteOldRecords($table, $dateColumn, $cutoffDate, $pdo, $config) {
    $maxRecords = $config['safety']['max_records_per_run'];
    
    // First check how many records will be deleted
    $checkQuery = "SELECT COUNT(*) as count FROM `$table` WHERE `$dateColumn` < :cutoff";
    $stmt = $pdo->prepare($checkQuery);
    $stmt->execute(['cutoff' => $cutoffDate]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $recordCount = $result['count'];
    
    if ($recordCount === 0) {
        pruneLog("No records to prune from $table");
        return 0;
    }
    
    if ($recordCount > $config['safety']['max_records_per_run'] && !$force) {
        pruneLog("WARNING: $recordCount records to delete from $table exceeds safety limit of $maxRecords");
        if ($config['monitoring']['alert_on_large_deletions']) {
            sendPruneAlert('Large Deletion Warning', "Attempted to delete $recordCount records from $table, but safety limit is $maxRecords. Use --force to override.");
        }
        return 0;
    }
    
    // Archive before deletion
    if (archiveRecords($table, $dateColumn, $cutoffDate, $pdo, $config)) {
        pruneLog("Records archived successfully");
    }
    
    // Delete records in batches
    $deleteQuery = "DELETE FROM `$table` WHERE `$dateColumn` < :cutoff LIMIT $maxRecords";
    $stmt = $pdo->prepare($deleteQuery);
    
    $deletedCount = 0;
    $totalDeleted = 0;
    
    do {
        $stmt->execute(['cutoff' => $cutoffDate]);
        $deletedCount = $stmt->rowCount();
        $totalDeleted += $deletedCount;
        pruneLog("Deleted batch of $deletedCount records from $table");
    } while ($deletedCount > 0 && $totalDeleted < $maxRecords);
    
    pruneLog("Total deleted from $table: $totalDeleted records");
    
    return $totalDeleted;
}

/**
 * Prune shopping carts
 */
function pruneShoppingCarts($pdo, $config, $dryRun = false) {
    pruneLog("=== Pruning Shopping Carts ===");
    
    $retentionDays = $config['retention']['shopping_carts'];
    $cutoffDate = date('Y-m-d H:i:s', strtotime("-$retentionDays days"));
    
    // Get cart items to prune
    $query = "SELECT COUNT(*) as count FROM cart_items WHERE created_at < :cutoff";
    $stmt = $pdo->prepare($query);
    $stmt->execute(['cutoff' => $cutoffDate]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    pruneLog("Found {$result['count']} cart items older than $retentionDays days");
    
    if ($dryRun) {
        pruneLog("DRY RUN: Would delete {$result['count']} cart items");
        return $result['count'];
    }
    
    if ($result['count'] > 0) {
        $deleteQuery = "DELETE FROM cart_items WHERE created_at < :cutoff";
        $stmt = $pdo->prepare($deleteQuery);
        $stmt->execute(['cutoff' => $cutoffDate]);
        $deleted = $stmt->rowCount();
        pruneLog("Deleted $deleted cart items");
        return $deleted;
    }
    
    return 0;
}

/**
 * Prune sessions
 */
function pruneSessions($pdo, $config, $dryRun = false) {
    pruneLog("=== Pruning Sessions ===");
    
    $retentionDays = $config['retention']['sessions'];
    $cutoffDate = date('Y-m-d H:i:s', strtotime("-$retentionDays days"));
    
    // Check if sessions table exists
    $tableExists = $pdo->query("SHOW TABLES LIKE 'sessions'")->fetch();
    if (!$tableExists) {
        pruneLog("Sessions table does not exist, skipping");
        return 0;
    }
    
    $query = "SELECT COUNT(*) as count FROM sessions WHERE last_activity < :cutoff";
    $stmt = $pdo->prepare($query);
    $stmt->execute(['cutoff' => $cutoffDate]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    pruneLog("Found {$result['count']} sessions older than $retentionDays days");
    
    if ($dryRun) {
        pruneLog("DRY RUN: Would delete {$result['count']} sessions");
        return $result['count'];
    }
    
    if ($result['count'] > 0) {
        $deleteQuery = "DELETE FROM sessions WHERE last_activity < :cutoff";
        $stmt = $pdo->prepare($deleteQuery);
        $stmt->execute(['cutoff' => $cutoffDate]);
        $deleted = $stmt->rowCount();
        pruneLog("Deleted $deleted sessions");
        return $deleted;
    }
    
    return 0;
}

/**
 * Prune notifications
 */
function pruneNotifications($pdo, $config, $dryRun = false) {
    pruneLog("=== Pruning Notifications ===");
    
    $retentionDays = $config['retention']['notifications'];
    $cutoffDate = date('Y-m-d H:i:s', strtotime("-$retentionDays days"));
    
    // Check if notifications table exists
    $tableExists = $pdo->query("SHOW TABLES LIKE 'notifications'")->fetch();
    if (!$tableExists) {
        pruneLog("Notifications table does not exist, skipping");
        return 0;
    }
    
    $query = "SELECT COUNT(*) as count FROM notifications WHERE is_read = 1 AND created_at < :cutoff";
    $stmt = $pdo->prepare($query);
    $stmt->execute(['cutoff' => $cutoffDate]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    pruneLog("Found {$result['count']} read notifications older than $retentionDays days");
    
    if ($dryRun) {
        pruneLog("DRY RUN: Would delete {$result['count']} notifications");
        return $result['count'];
    }
    
    if ($result['count'] > 0) {
        $deleteQuery = "DELETE FROM notifications WHERE is_read = 1 AND created_at < :cutoff";
        $stmt = $pdo->prepare($deleteQuery);
        $stmt->execute(['cutoff' => $cutoffDate]);
        $deleted = $stmt->rowCount();
        pruneLog("Deleted $deleted notifications");
        return $deleted;
    }
    
    return 0;
}

/**
 * Archive orders
 */
function archiveOrders($pdo, $config, $dryRun = false) {
    pruneLog("=== Archiving Orders ===");
    
    $retentionDays = $config['retention']['orders'];
    $cutoffDate = date('Y-m-d H:i:s', strtotime("-$retentionDays days"));
    
    // Check if orders table exists
    $tableExists = $pdo->query("SHOW TABLES LIKE 'orders'")->fetch();
    if (!$tableExists) {
        pruneLog("Orders table does not exist, skipping");
        return 0;
    }
    
    $query = "SELECT COUNT(*) as count FROM orders WHERE created_at < :cutoff";
    $stmt = $pdo->prepare($query);
    $stmt->execute(['cutoff' => $cutoffDate]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    pruneLog("Found {$result['count']} orders older than $retentionDays days");
    
    if ($dryRun) {
        pruneLog("DRY RUN: Would archive {$result['count']} orders");
        return $result['count'];
    }
    
    if ($result['count'] > 0) {
        return deleteOldRecords('orders', 'created_at', $cutoffDate, $pdo, $config);
    }
    
    return 0;
}

/**
 * Archive system logs
 */
function archiveSystemLogs($pdo, $config, $dryRun = false) {
    pruneLog("=== Archiving System Logs ===");
    
    $retentionDays = $config['retention']['system_logs'];
    $cutoffDate = date('Y-m-d H:i:s', strtotime("-$retentionDays days"));
    
    // Check if system_logs table exists
    $tableExists = $pdo->query("SHOW TABLES LIKE 'system_logs'")->fetch();
    if (!$tableExists) {
        pruneLog("System logs table does not exist, skipping");
        return 0;
    }
    
    $query = "SELECT COUNT(*) as count FROM system_logs WHERE created_at < :cutoff";
    $stmt = $pdo->prepare($query);
    $stmt->execute(['cutoff' => $cutoffDate]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    pruneLog("Found {$result['count']} system logs older than $retentionDays days");
    
    if ($dryRun) {
        pruneLog("DRY RUN: Would archive {$result['count']} system logs");
        return $result['count'];
    }
    
    if ($result['count'] > 0) {
        return deleteOldRecords('system_logs', 'created_at', $cutoffDate, $pdo, $config);
    }
    
    return 0;
}

// Main execution
try {
    if (!$config['enabled']) {
        pruneLog("Data pruning is disabled in configuration");
        exit(0);
    }

    pruneLog("=== Starting Data Pruning - Type: $type ===");
    pruneLog("Dry Run: " . ($dryRun ? 'YES' : 'NO'));
    
    $totalDeleted = 0;
    
    // Execute based on type
    switch ($type) {
        case 'daily':
            $totalDeleted += pruneShoppingCarts($pdo, $config, $dryRun);
            $totalDeleted += pruneSessions($pdo, $config, $dryRun);
            $totalDeleted += pruneNotifications($pdo, $config, $dryRun);
            break;
            
        case 'weekly':
            $totalDeleted += archiveSystemLogs($pdo, $config, $dryRun);
            // Add user activity pruning when table exists
            break;
            
        case 'monthly':
            $totalDeleted += archiveOrders($pdo, $config, $dryRun);
            // Add product reviews pruning when table exists
            break;
            
        default:
            pruneLog("Unknown pruning type: $type");
            pruneLog("Valid types: daily, weekly, monthly");
            exit(1);
    }
    
    pruneLog("=== Data Pruning Completed ===");
    pruneLog("Total records processed: $totalDeleted");
    
    if ($totalDeleted > 0 && $config['monitoring']['alert_on_large_deletions'] && $totalDeleted > 1000) {
        sendPruneAlert('Data Pruning Completed', "Successfully pruned $totalDeleted records in $type run.");
    }
    
    exit(0);
    
} catch (Exception $e) {
    pruneLog("ERROR: " . $e->getMessage());
    sendPruneAlert('Data Pruning Failed', $e->getMessage());
    exit(1);
}
