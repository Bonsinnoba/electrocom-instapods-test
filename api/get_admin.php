<?php
require 'db.php';
$stmt = $pdo->prepare("SELECT email, role FROM users WHERE role IN ('admin', 'super', 'store_manager') LIMIT 1");
$stmt->execute();
$user = $stmt->fetch(PDO::FETCH_ASSOC);
if ($user) {
    echo json_encode($user);
} else {
    echo "none";
}
