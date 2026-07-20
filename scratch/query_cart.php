<?php
require 'api/db.php';
try {
    $stmt = $pdo->query("SELECT * FROM cart");
    echo "--- CART TABLE ---\n";
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
} catch (Exception $e) {
    echo "Error querying cart: " . $e->getMessage() . "\n";
}

try {
    $stmt = $pdo->query("SELECT * FROM cart_items");
    echo "--- CART ITEMS TABLE ---\n";
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
} catch (Exception $e) {
    echo "Error querying cart_items: " . $e->getMessage() . "\n";
}
