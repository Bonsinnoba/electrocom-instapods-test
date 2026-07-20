<?php
// Clear access restrictions to fix auto-ban
error_reporting(E_ALL);
ini_set('display_errors', 1);

require 'db.php';

echo "Clearing access restrictions...\n\n";

try {
    // Clear all access restrictions
    $stmt = $pdo->exec("DELETE FROM access_restrictions");
    echo "Deleted $stmt rows from access_restrictions\n";
    
    echo "\nAccess restrictions cleared successfully.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
