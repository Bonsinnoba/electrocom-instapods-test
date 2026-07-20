<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/cache.php';

$sql = file_get_contents(__DIR__ . '/migrations/030_add_flash_sale_banner_setting.sql');
try {
    global $pdo;
    $pdo->exec($sql);
    echo "Migration 030 completed successfully.\n";
    // Invalidate settings cache
    eh_cache_set('db_settings', null, 'settings', 0);
    eh_cache_set('merged_settings', null, 'settings', 0);
    eh_cache_set('always_load_settings', null, 'settings', 0);
    echo "Cache invalidated.\n";
} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
