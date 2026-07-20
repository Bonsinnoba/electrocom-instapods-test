<?php
// backend/admin_reports_list.php
require_once 'cors_middleware.php';
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

// Ensure the caller is an admin/super/accountant
requireRole(['super', 'store_manager', 'accountant'], $pdo);

$reportsDir = __DIR__ . '/data/reports';
$filesList = [];

if (is_dir($reportsDir)) {
    $files = scandir($reportsDir);
    foreach ($files as $file) {
        if ($file !== '.' && $file !== '..' && preg_match('/\.csv$/', $file)) {
            $filePath = $reportsDir . '/' . $file;
            $filesList[] = [
                'filename' => $file,
                'created_at' => date('c', filectime($filePath)),
                'size' => filesize($filePath)
            ];
        }
    }
}

// Sort by newest first
usort($filesList, function($a, $b) {
    return strcmp($b['filename'], $a['filename']);
});

echo json_encode(['success' => true, 'data' => $filesList]);
