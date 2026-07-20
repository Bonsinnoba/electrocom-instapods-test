<?php
require 'db.php';
$stmt = $pdo->prepare('SELECT id, name, role, status FROM users');
$stmt->execute();
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
