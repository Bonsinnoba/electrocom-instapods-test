<?php
/**
 * Diagnostic script to list all tables with exact case
 * Run this to check table name case sensitivity issues
 */
require_once 'db.php';

try {
    // Get all table names with exact case
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    echo "=== Table Names (Exact Case) ===\n";
    echo "Total tables: " . count($tables) . "\n\n";
    
    foreach ($tables as $table) {
        echo "- $table\n";
    }
    
    echo "\n=== Checking Common Tables ===\n";
    $commonTables = ['products', 'users', 'orders', 'categories', 'abandoned_carts'];
    
    foreach ($commonTables as $expected) {
        $found = in_array($expected, $tables);
        $status = $found ? '✓ FOUND' : '✗ NOT FOUND';
        echo "$expected: $status\n";
        
        // Check for case variations
        if (!$found) {
            foreach ($tables as $actual) {
                if (strtolower($actual) === strtolower($expected)) {
                    echo "  → Case mismatch found: '$actual' (expected '$expected')\n";
                }
            }
        }
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
