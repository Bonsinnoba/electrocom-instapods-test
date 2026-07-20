<?php
// Clear rate limits to fix auto-ban
error_reporting(E_ALL);
ini_set('display_errors', 1);

require 'db.php';

echo "Clearing rate limits...\n\n";

try {
    // Clear all rate limits
    $stmt = $pdo->exec("DELETE FROM api_rate_limits");
    echo "Deleted $stmt rows from api_rate_limits\n";
    
    echo "\nRate limits cleared successfully.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
