<?php
require_once __DIR__ . '/db.php';

try {
    $pdo->exec("DROP TABLE IF EXISTS wallet_transactions;");
    echo "Dropped wallet_transactions table\n";

    $hasWalletBalance = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'wallet_balance'")->fetchColumn();
    if ($hasWalletBalance > 0) {
        $pdo->exec("ALTER TABLE users DROP COLUMN wallet_balance;");
        echo "Dropped wallet_balance column from users\n";
    }

    echo "Cleanup complete!\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
