<?php
// Run migration 033: Create refresh_tokens table
require_once 'db.php';

try {
    $sql = file_get_contents(__DIR__ . '/migrations/033_create_refresh_tokens_table.sql');
    $pdo->exec($sql);
    echo "Migration 033 executed successfully: refresh_tokens table created.\n";
} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
