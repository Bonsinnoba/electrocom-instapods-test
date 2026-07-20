<?php
require_once 'db.php';
header('Content-Type: text/plain');

echo "--- STARTING MIGRATION: ADD DISCOUNT COLUMNS ---\n";

try {
    // Check if discount_percent column exists
    $cols = $pdo->query("DESCRIBE products")->fetchAll(PDO::FETCH_COLUMN);
    
    if (!in_array('discount_percent', $cols)) {
        echo "Adding column 'discount_percent'...\n";
        $pdo->exec("ALTER TABLE products ADD COLUMN discount_percent INT DEFAULT 0 AFTER price");
        echo "Successfully added 'discount_percent'.\n";
    } else {
        echo "Column 'discount_percent' already exists.\n";
    }

    if (!in_array('sale_ends_at', $cols)) {
        echo "Adding column 'sale_ends_at'...\n";
        $pdo->exec("ALTER TABLE products ADD COLUMN sale_ends_at DATETIME DEFAULT NULL AFTER discount_percent");
        echo "Successfully added 'sale_ends_at'.\n";
    } else {
        echo "Column 'sale_ends_at' already exists.\n";
    }

    echo "\n--- MIGRATION COMPLETE ---\n";
} catch (Exception $e) {
    echo "MIGRATION FAILED: " . $e->getMessage() . "\n";
}
