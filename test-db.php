<?php
require_once __DIR__ . '/api/config.php';

$host = $config['DB_HOST'];
$port = $config['DB_PORT'] ?? 16052;
$db   = $config['DB_NAME'];
$user = $config['DB_USER'];
$pass = $config['DB_PASS'];
$ssl  = $config['DB_SSL'] ?? false;

$dsn = "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4";

$options = [
    PDO::ATTR_ERRMODE                  => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE       => PDO::FETCH_ASSOC,
];

if ($ssl) {
    $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
}

try {
    echo "Connecting to {$host}:{$port}/{$db} as {$user} (password=" . ($pass !== '' ? 'set' : 'missing') . ", ssl=" . ($ssl ? 'enabled' : 'disabled') . ")...\n";
    $pdo = new PDO($dsn, $user, $pass, $options);
    echo "SUCCESS: Connected to Aiven MySQL successfully!\n";
} catch (\PDOException $e) {
    echo "FAILED: " . $e->getMessage() . "\n";
}