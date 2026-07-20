<?php
// Test script to debug super_settings.php
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "Testing super_settings.php dependencies...\n\n";

// Test 1: Check if required files exist
echo "1. Checking required files:\n";
$requiredFiles = [
    'cors_middleware.php',
    'db.php',
    'security.php',
    'cache.php',
    'brand_settings.php'
];
foreach ($requiredFiles as $file) {
    $exists = file_exists(__DIR__ . '/' . $file);
    echo "   - $file: " . ($exists ? 'OK' : 'MISSING') . "\n";
}

// Test 2: Check if cache directory exists
echo "\n2. Checking cache directory:\n";
$cacheDir = __DIR__ . '/cache';
echo "   - Cache directory exists: " . (is_dir($cacheDir) ? 'YES' : 'NO') . "\n";
if (!is_dir($cacheDir)) {
    echo "   - Creating cache directory...\n";
    mkdir($cacheDir, 0755, true);
}

// Test 3: Check if data directory exists
echo "\n3. Checking data directory:\n";
$dataDir = __DIR__ . '/data';
echo "   - Data directory exists: " . (is_dir($dataDir) ? 'YES' : 'NO') . "\n";
if (!is_dir($dataDir)) {
    echo "   - Creating data directory...\n";
    mkdir($dataDir, 0755, true);
}

// Test 4: Test cache functions
echo "\n4. Testing cache functions:\n";
try {
    require_once __DIR__ . '/cache.php';
    echo "   - cache.php loaded: OK\n";
    
    $backend = eh_cache_init();
    echo "   - Cache backend initialized: OK\n";
    
    $testResult = eh_cache_set('test_key', 'test_value', 'test_group', 60);
    echo "   - Cache set: " . ($testResult ? 'OK' : 'FAILED') . "\n";
    
    $testGet = eh_cache_get('test_key', 'test_group');
    echo "   - Cache get: " . ($testGet === 'test_value' ? 'OK' : 'FAILED') . "\n";
    
    $testDelete = eh_cache_delete('test_key', 'test_group');
    echo "   - Cache delete: " . ($testDelete ? 'OK' : 'FAILED') . "\n";
} catch (Exception $e) {
    echo "   - Cache functions FAILED: " . $e->getMessage() . "\n";
}

// Test 5: Test brand_settings functions
echo "\n5. Testing brand_settings functions:\n";
try {
    require_once __DIR__ . '/brand_settings.php';
    echo "   - brand_settings.php loaded: OK\n";
    
    $defaults = eh_super_settings_defaults_full();
    echo "   - Get defaults: OK (count: " . count($defaults) . ")\n";
    
    $criticalKeys = eh_critical_db_settings_keys();
    echo "   - Get critical keys: OK (count: " . count($criticalKeys) . ")\n";
    
    $path = eh_super_settings_path();
    echo "   - Settings path: $path\n";
    echo "   - Settings file exists: " . (file_exists($path) ? 'YES' : 'NO') . "\n";
} catch (Exception $e) {
    echo "   - brand_settings functions FAILED: " . $e->getMessage() . "\n";
}

// Test 6: Test database connection
echo "\n6. Testing database connection:\n";
try {
    require_once __DIR__ . '/db.php';
    global $pdo;
    echo "   - Database connected: OK\n";
    
    // Check if site_settings table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'site_settings'");
    $tableExists = $stmt->fetch();
    echo "   - site_settings table exists: " . ($tableExists ? 'YES' : 'NO') . "\n";
    
    if ($tableExists) {
        // Check table structure
        $stmt = $pdo->query("DESCRIBE site_settings");
        $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
        echo "   - Table columns: " . implode(', ', $columns) . "\n";
        
        // Check if there are any settings
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM site_settings");
        $count = $stmt->fetch()['count'];
        echo "   - Number of settings in DB: $count\n";
    }
} catch (Exception $e) {
    echo "   - Database connection FAILED: " . $e->getMessage() . "\n";
}

// Test 7: Test merged settings
echo "\n7. Testing merged settings:\n";
try {
    $merged = eh_merged_super_settings(true);
    echo "   - Get merged settings: OK (count: " . count($merged) . ")\n";
} catch (Exception $e) {
    echo "   - Get merged settings FAILED: " . $e->getMessage() . "\n";
    echo "   - File: " . $e->getFile() . "\n";
    echo "   - Line: " . $e->getLine() . "\n";
}

echo "\n=== Test Complete ===\n";
