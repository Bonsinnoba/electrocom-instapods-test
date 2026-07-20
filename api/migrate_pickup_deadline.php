<?php
require_once 'db.php';
header('Content-Type: text/plain');

echo "--- STARTING MIGRATION: ADD PICKUP DEADLINE DAYS ---\n";

try {
    // Check if column exists
    $cols = $pdo->query("DESCRIBE pickup_locations")->fetchAll(PDO::FETCH_COLUMN);

    if (!in_array('pickup_deadline_days', $cols)) {
        echo "Adding column 'pickup_deadline_days'...\n";
        $pdo->exec("ALTER TABLE pickup_locations ADD COLUMN pickup_deadline_days INT DEFAULT 7 AFTER id_requirements");
        echo "Successfully added 'pickup_deadline_days'.\n";
    } else {
        echo "Column 'pickup_deadline_days' already exists.\n";
    }

    echo "\n--- MIGRATION COMPLETE ---\n";
} catch (Exception $e) {
    echo "MIGRATION FAILED: " . $e->getMessage() . "\n";
}
