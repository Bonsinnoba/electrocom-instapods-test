<?php
require_once 'db.php';
header('Content-Type: text/plain');

echo "--- STARTING MIGRATION: ADD PICKUP LOCATION COORDINATES ---\n";

try {
    // Check if latitude column exists
    $cols = $pdo->query("DESCRIBE pickup_locations")->fetchAll(PDO::FETCH_COLUMN);
    
    if (!in_array('latitude', $cols)) {
        echo "Adding column 'latitude'...\n";
        $pdo->exec("ALTER TABLE pickup_locations ADD COLUMN latitude DECIMAL(10, 8) DEFAULT NULL AFTER city");
        echo "Successfully added 'latitude'.\n";
    } else {
        echo "Column 'latitude' already exists.\n";
    }

    if (!in_array('longitude', $cols)) {
        echo "Adding column 'longitude'...\n";
        $pdo->exec("ALTER TABLE pickup_locations ADD COLUMN longitude DECIMAL(11, 8) DEFAULT NULL AFTER latitude");
        echo "Successfully added 'longitude'.\n";
    } else {
        echo "Column 'longitude' already exists.\n";
    }

    // Update existing pickup locations with approximate coordinates
    echo "\nUpdating existing pickup locations with coordinates...\n";
    
    // Accra area (Madina): ~5.6833° N, -0.1667° W
    $stmt = $pdo->prepare("UPDATE pickup_locations SET latitude = 5.6833, longitude = -0.1667 WHERE city LIKE ? OR address LIKE ?");
    $stmt->execute(['%Accra%', '%Accra%']);
    echo "Updated Accra locations.\n";

    // Wa area: ~10.0623° N, -2.5086° W  
    $stmt = $pdo->prepare("UPDATE pickup_locations SET latitude = 10.0623, longitude = -2.5086 WHERE city LIKE ? OR address LIKE ?");
    $stmt->execute(['%Wa%', '%Wa%']);
    echo "Updated Wa locations.\n";

    echo "\n--- MIGRATION COMPLETE ---\n";
} catch (Exception $e) {
    echo "MIGRATION FAILED: " . $e->getMessage() . "\n";
}
