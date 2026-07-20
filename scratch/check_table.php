<?php
require '../api/db.php';
global $pdo;

$stmt = $pdo->query("SHOW COLUMNS FROM site_settings WHERE Field = 'category'");
$row = $stmt->fetch(PDO::FETCH_ASSOC);
echo "Category column type: " . $row['Type'] . "\n";

$stmt = $pdo->query("SELECT * FROM site_settings LIMIT 5");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo "\nSample data:\n";
foreach ($rows as $row) {
    echo $row['setting_key'] . " => " . $row['category'] . "\n";
}
