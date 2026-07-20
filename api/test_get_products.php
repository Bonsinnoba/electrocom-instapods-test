<?php
// Test script to call get_products.php
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "Testing get_products.php endpoint...\n\n";

// Simulate a GET request
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['HTTP_HOST'] = '127.0.0.1:8000';

try {
    include 'get_products.php';
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . ":" . $e->getLine() . "\n";
}
