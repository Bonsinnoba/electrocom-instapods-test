<?php require 'api/db.php'; print_r($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN));
