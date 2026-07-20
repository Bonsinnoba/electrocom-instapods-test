<?php
require 'api/db.php';
try {
    $stmt = $pdo->query("SELECT id, name, colors FROM products LIMIT 20");
    echo "--- PRODUCTS ---\n";
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        echo "ID: {$row['id']} | Name: {$row['name']} | Colors: {$row['colors']}\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
