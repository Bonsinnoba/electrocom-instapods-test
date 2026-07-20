<?php
require_once 'db.php';
header('Content-Type: text/plain');

echo "--- CHECKING PICKUP LOCATIONS ---\n";

try {
    $stmt = $pdo->query("SELECT * FROM pickup_locations ORDER BY created_at DESC");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Total locations: " . count($rows) . "\n\n";
    
    foreach ($rows as $row) {
        echo "ID: " . $row['id'] . "\n";
        echo "Name: " . $row['name'] . "\n";
        echo "Address: " . $row['address'] . "\n";
        echo "City: " . ($row['city'] ?? 'NULL') . "\n";
        echo "Latitude: " . ($row['latitude'] ?? 'NULL') . "\n";
        echo "Longitude: " . ($row['longitude'] ?? 'NULL') . "\n";
        echo "Fee: " . $row['fee'] . "\n";
        echo "Active: " . ($row['is_active'] ? 'Yes' : 'No') . "\n";
        echo "Created: " . $row['created_at'] . "\n";
        echo "---\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
