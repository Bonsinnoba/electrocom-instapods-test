<?php
require 'api/db.php';
try {
    // Check if index already exists to avoid errors
    $stmt = $pdo->query("SHOW INDEX FROM traffic_logs WHERE Key_name = 'idx_traffic_created'");
    if (!$stmt->fetch()) {
        $pdo->exec("CREATE INDEX idx_traffic_created ON traffic_logs(created_at)");
        echo "Index 'idx_traffic_created' created successfully." . PHP_EOL;
    } else {
        echo "Index already exists." . PHP_EOL;
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . PHP_EOL;
}
