<?php
// Test script to check products
error_reporting(E_ALL);
ini_set('display_errors', 1);

require 'db.php';

echo "Testing products table...\n\n";

try {
    // Check if products table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'products'");
    $tableExists = $stmt->fetch();
    echo "Products table exists: " . ($tableExists ? 'YES' : 'NO') . "\n";
    
    if ($tableExists) {
        // Count products
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM products");
        $count = $stmt->fetch()['count'];
        echo "Total products: $count\n";
        
        // Get sample products
        $stmt = $pdo->query("SELECT id, name, status, stock_quantity FROM products LIMIT 5");
        $products = $stmt->fetchAll();
        echo "\nSample products:\n";
        foreach ($products as $p) {
            echo "  - ID: {$p['id']}, Name: {$p['name']}, Status: {$p['status']}, Stock: {$p['stock_quantity']}\n";
        }
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
