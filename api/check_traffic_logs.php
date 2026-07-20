<?php
// Check traffic logs to see what caused the rate limit
error_reporting(E_ALL);
ini_set('display_errors', 1);

require 'db.php';

echo "Checking traffic logs...\n\n";

try {
    // Check traffic logs table structure
    $stmt = $pdo->query("DESCRIBE traffic_logs");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "Traffic logs columns: " . implode(', ', $columns) . "\n\n";
    
    // Check traffic logs from the last 2 minutes
    $stmt = $pdo->query("
        SELECT ip_address, request_url, COUNT(*) as count 
        FROM traffic_logs 
        WHERE created_at > DATE_SUB(NOW(), INTERVAL 2 MINUTE)
        GROUP BY ip_address, request_url 
        ORDER BY count DESC 
        LIMIT 20
    ");
    $logs = $stmt->fetchAll();
    
    echo "Traffic from last 2 minutes:\n";
    foreach ($logs as $log) {
        echo "  - IP: {$log['ip_address']}, Endpoint: {$log['request_url']}, Count: {$log['count']}\n";
    }
    
    // Check total requests in last minute
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM traffic_logs WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)");
    $total = $stmt->fetch()['count'];
    echo "\nTotal requests in last minute: $total\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
