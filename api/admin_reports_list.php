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
            $createdAt = date('c', filectime($filePath));

            // Extract ISO week (e.g. 2026-W21) if present in filename
            if (preg_match('/(\d{4})-W(\d{1,2})/i', $file, $matches)) {
                $year = (int)$matches[1];
                $week = (int)$matches[2];
                try {
                    $dto = new DateTime();
                    $dto->setISODate($year, $week, 7); // Sunday of that week at 23:59:59
                    $dto->setTime(23, 59, 59);
                    $createdAt = $dto->format('Y-m-d\TH:i:s');
                } catch (Exception $e) {
                    // Fallback to filectime if date parsing fails
                }
            }

            $filesList[] = [
                'filename' => $file,
                'created_at' => $createdAt,
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
