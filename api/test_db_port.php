<?php
$hosts = ['localhost', '127.0.0.1', '127.0.0.1:3306', 'localhost:3306', 'localhost:10017', '127.0.0.1:10017'];
$user = 'root';
$pass = 'root';
$db = 'local';

foreach ($hosts as $host) {
    try {
        $dsn = "mysql:host=$host;dbname=$db;charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        echo "SUCCESS connecting to host: $host\n";
        $stmt = $pdo->query("SELECT id, name, role, status FROM users");
        print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
        break;
    } catch (Exception $e) {
        echo "FAILED connecting to host: $host - " . $e->getMessage() . "\n";
    }
}
