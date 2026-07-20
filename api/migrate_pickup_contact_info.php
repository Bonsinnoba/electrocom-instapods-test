<?php
require_once 'db.php';
header('Content-Type: text/plain');

echo "--- STARTING MIGRATION: ADD PICKUP LOCATION CONTACT INFO ---\n";

try {
    // Check if columns exist
    $cols = $pdo->query("DESCRIBE pickup_locations")->fetchAll(PDO::FETCH_COLUMN);

    $newColumns = [
        'contact_person' => "VARCHAR(150) DEFAULT NULL AFTER longitude",
        'contact_phone' => "VARCHAR(20) DEFAULT NULL AFTER contact_person",
        'pickup_instructions' => "TEXT DEFAULT NULL AFTER contact_phone",
        'what_to_bring' => "TEXT DEFAULT NULL AFTER pickup_instructions",
        'id_requirements' => "TEXT DEFAULT NULL AFTER what_to_bring"
    ];

    foreach ($newColumns as $colName => $colDef) {
        if (!in_array($colName, $cols)) {
            echo "Adding column '$colName'...\n";
            $pdo->exec("ALTER TABLE pickup_locations ADD COLUMN $colName $colDef");
            echo "Successfully added '$colName'.\n";
        } else {
            echo "Column '$colName' already exists.\n";
        }
    }

    echo "\n--- MIGRATION COMPLETE ---\n";
} catch (Exception $e) {
    echo "MIGRATION FAILED: " . $e->getMessage() . "\n";
}
