<?php
require 'db.php';
date_default_timezone_set('GMT');
echo "<h1>Welcome to my Shop</h1>";

$stmt = $pdo->query("SELECT * FROM products");
while ($row = $stmt->fetch()) {
    echo $row['name'] . " - $" . $row['price'] . "<br>";
}
