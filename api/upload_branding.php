<?php
/**
 * upload_branding.php
 * Handles file uploads for Site Logo and Favicon.
 */

require 'cors_middleware.php';
require 'db.php';
require 'security.php';

header('Content-Type: application/json');

try {
    // Authenticate and Require 'super' role
    $userId = authenticate($pdo);
    requireRole('super', $pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

try {
    if (!isset($_FILES['file'])) {
        throw new Exception('No file was uploaded.');
    }

    $file = $_FILES['file'];
    $type = $_POST['type'] ?? 'logo'; // 'logo' or 'favicon'
    $oldPath = $_POST['oldPath'] ?? '';

    // validation
    $allowedLogoExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
    $allowedFavExts  = ['ico', 'png', 'svg'];
    
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed = ($type === 'favicon') ? $allowedFavExts : $allowedLogoExts;

    if (!in_array($ext, $allowed)) {
        throw new Exception('Invalid file format. Allowed: ' . implode(', ', $allowed));
    }

    // Size limits: 2MB for logo, 500KB for favicon
    $maxSize = ($type === 'favicon') ? 500 * 1024 : 2 * 1024 * 1024;
    if ($file['size'] > $maxSize) {
        throw new Exception('File is too large. Max allowed: ' . ($maxSize / 1024) . 'KB');
    }

    $uploadDir = __DIR__ . '/uploads/branding/';
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    $filename = $type . '_' . uniqid() . '.' . $ext;
    $targetPath = $uploadDir . $filename;

    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        $publicUrl = "uploads/branding/" . $filename;

        // Cleanup old file if requested and it's a local file
        if ($oldPath && strpos($oldPath, 'uploads/branding/') !== false) {
            $fullOldPath = __DIR__ . '/' . $oldPath;
            if (file_exists($fullOldPath) && is_file($fullOldPath)) {
                unlink($fullOldPath);
            }
        }

        logger('info', 'SYSTEM', "Branding asset ({$type}) uploaded: {$publicUrl} by User ID {$userId}");
        
        echo json_encode([
            'success' => true,
            'url' => $publicUrl,
            'message' => 'File uploaded successfully.'
        ]);
    } else {
        throw new Exception('Failed to move uploaded file.');
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
