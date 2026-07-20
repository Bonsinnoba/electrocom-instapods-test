<?php
require_once 'api/db.php';
$stmt = $pdo->query('SELECT * FROM access_restrictions');
$restrictions = $stmt->fetchAll();
if (empty($restrictions)) {
    echo "No restrictions found.\n";
} else {
    print_r($restrictions);
}
