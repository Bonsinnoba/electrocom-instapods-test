<?php
// api/archive_restore.php
// Restore data from archives
// Run via: php /path/to/api/archive_restore.php --table=orders --archive=orders_20250527_120000.json.gz

require 'db.php';
require 'security.php';
require_once 'data_pruning_config.php';

// Parse command line arguments
$options = getopt('', ['table:', 'archive:', 'dry-run']);
$table = $options['table'] ?? null;
$archiveFile = $options['archive'] ?? null;
$dryRun = isset($options['dry-run']);

$config = require 'data_pruning_config.php';

// Log file
$logFile = __DIR__ . '/logs/archive_restore.log';
if (!is_dir(dirname($logFile))) {
    mkdir(dirname($logFile), 0755, true);
}

/**
 * Log restore activity
 */
function restoreLog($message) {
    global $logFile;
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[$timestamp] $message\n";
    file_put_contents($logFile, $logMessage, FILE_APPEND);
    echo $logMessage;
}

/**
 * Send alert email on restore failure
 */
function sendRestoreAlert($subject, $message) {
    global $config;
    $to = $config['ADMIN_EMAIL'] ?? 'admin@example.com';
    $from = $config['FROM_EMAIL'] ?? 'noreply@example.com';
    $appName = $config['APP_NAME'] ?? 'EssentialsHub';

    $body = "Archive Restore Alert - $appName\n";
    $body .= "==============================\n\n";
    $body .= "Time: " . date('Y-m-d H:i:s') . "\n\n";
    $body .= "$message\n\n";
    $body .= "Please check the server and archive configuration.\n";
    $body .= "Log file: " . __DIR__ . '/logs/archive_restore.log';

    $headers = "From: $from\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();

    @mail($to, "[$appName] $subject", $body, $headers);
    restoreLog("Alert email sent to: $to - $subject");
}

/**
 * Load archive data
 */
function loadArchiveData($archiveFile, $config) {
    $archiveDir = $config['archive']['location'];
    $fullPath = $archiveDir . '/' . $archiveFile;
    
    if (!file_exists($fullPath)) {
        throw new Exception("Archive file not found: $fullPath");
    }
    
    $data = file_get_contents($fullPath);
    
    // Decompress if needed
    if (strpos($archiveFile, '.gz') !== false) {
        $data = gzdecode($data);
        if ($data === false) {
            throw new Exception("Failed to decompress archive file");
        }
    }
    
    $records = json_decode($data, true);
    if ($records === null) {
        throw new Exception("Failed to decode archive JSON");
    }
    
    return $records;
}

/**
 * Restore records to table
 */
function restoreRecords($table, $records, $pdo, $dryRun = false) {
    if (empty($records)) {
        restoreLog("No records to restore");
        return 0;
    }
    
    restoreLog("Restoring " . count($records) . " records to $table");
    
    // Get column names from first record
    $columns = array_keys($records[0]);
    $columnList = '`' . implode('`, `', $columns) . '`';
    
    // Build insert query
    $placeholders = implode(', ', array_fill(0, count($columns), '?'));
    $query = "INSERT INTO `$table` ($columnList) VALUES ($placeholders)";
    
    if ($dryRun) {
        restoreLog("DRY RUN: Would insert " . count($records) . " records into $table");
        return count($records);
    }
    
    $stmt = $pdo->prepare($query);
    $restoredCount = 0;
    
    foreach ($records as $record) {
        try {
            $values = array_values($record);
            $stmt->execute($values);
            $restoredCount++;
        } catch (PDOException $e) {
            restoreLog("Failed to restore record: " . $e->getMessage());
            // Continue with next record
        }
    }
    
    restoreLog("Successfully restored $restoredCount records to $table");
    return $restoredCount;
}

// Main execution
try {
    if (!$table || !$archiveFile) {
        restoreLog("ERROR: Missing required parameters");
        restoreLog("Usage: php archive_restore.php --table=orders --archive=orders_20250527_120000.json.gz [--dry-run]");
        exit(1);
    }
    
    restoreLog("=== Starting Archive Restore ===");
    restoreLog("Table: $table");
    restoreLog("Archive: $archiveFile");
    restoreLog("Dry Run: " . ($dryRun ? 'YES' : 'NO'));
    
    // Load archive data
    $records = loadArchiveData($archiveFile, $config);
    restoreLog("Loaded " . count($records) . " records from archive");
    
    // Restore records
    $restoredCount = restoreRecords($table, $records, $pdo, $dryRun);
    
    restoreLog("=== Archive Restore Completed ===");
    restoreLog("Total records restored: $restoredCount");
    
    if (!$dryRun && $restoredCount > 0) {
        restoreLog("Restore successful. Please verify data integrity.");
    }
    
    exit(0);
    
} catch (Exception $e) {
    restoreLog("ERROR: " . $e->getMessage());
    sendRestoreAlert('Archive Restore Failed', $e->getMessage());
    exit(1);
}
