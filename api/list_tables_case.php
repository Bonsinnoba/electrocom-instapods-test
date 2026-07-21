<?php
/**
 * Diagnostic script to list all tables with exact case
 * Run this to check table name case sensitivity issues
 */
// Skip CORS for diagnostic script - load config and create direct DB connection
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/config.php';

// Create direct PDO connection without CORS middleware
$host = $config['DB_HOST'];
$port = $config['DB_PORT'] ?? 3306;
$user = $config['DB_USER'];
$pass = $config['DB_PASS'];
$db   = $config['DB_NAME'];
$charset = 'utf8mb4';
$ssl = $config['DB_SSL'] ?? false;

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

$dsn = "mysql:host=$host;port=$port;dbname=$db;charset=$charset";

// Add SSL options for Aiven MySQL
if ($ssl) {
    $sslCaPaths = [
        '/etc/ssl/certs/ca-certificates.crt',
        '/etc/ssl/certs/ca-bundle.crt',
        '/etc/pki/tls/certs/ca-bundle.crt',
        '/usr/local/ssl/certs/ca-bundle.crt',
    ];
    
    $sslCaPath = null;
    foreach ($sslCaPaths as $path) {
        if (file_exists($path)) {
            $sslCaPath = $path;
            break;
        }
    }
    
    if ($sslCaPath) {
        $options[PDO::MYSQL_ATTR_SSL_CA] = $sslCaPath;
        $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
    } else {
        // Fallback: Enable SSL without certificate verification
        // Setting MYSQL_ATTR_SSL_CA to empty string still enables SSL mode
        $options[PDO::MYSQL_ATTR_SSL_CA] = '';
        $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
    }
}

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (PDOException $e) {
    echo "Database connection failed: " . $e->getMessage() . "\n";
    exit(1);
}

try {
    // Get all table names with exact case
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    echo "=== Table Names (Exact Case) ===\n";
    echo "Total tables: " . count($tables) . "\n\n";
    
    foreach ($tables as $table) {
        echo "- $table\n";
    }
    
    echo "\n=== Checking Common Tables ===\n";
    $commonTables = ['products', 'users', 'orders', 'categories', 'abandoned_carts'];
    
    foreach ($commonTables as $expected) {
        $found = in_array($expected, $tables);
        $status = $found ? '✓ FOUND' : '✗ NOT FOUND';
        echo "$expected: $status\n";
        
        // Check for case variations
        if (!$found) {
            foreach ($tables as $actual) {
                if (strtolower($actual) === strtolower($expected)) {
                    echo "  → Case mismatch found: '$actual' (expected '$expected')\n";
                }
            }
        }
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
