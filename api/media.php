<?php
/**
 * Serve uploaded media files safely when the host does not expose api/uploads
 * as a static directory.
 */

require_once __DIR__ . '/config.php';

$relativePath = trim((string)($_GET['path'] ?? ''));
$relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');

if ($relativePath === '' || strpos($relativePath, 'uploads/') !== 0 || strpos($relativePath, '..') !== false) {
    http_response_code(404);
    exit;
}

$uploadsRoot = realpath(__DIR__ . '/uploads');
$filePath = realpath(__DIR__ . '/' . $relativePath);

if ($uploadsRoot === false || $filePath === false || !is_file($filePath)) {
    http_response_code(404);
    exit;
}

$uploadsRoot = rtrim(str_replace('\\', '/', $uploadsRoot), '/') . '/';
$normalizedFilePath = str_replace('\\', '/', $filePath);
if (strpos($normalizedFilePath, $uploadsRoot) !== 0) {
    http_response_code(404);
    exit;
}

$mimeType = function_exists('mime_content_type')
    ? mime_content_type($filePath)
    : 'application/octet-stream';

$allowedTypes = [
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'video/mp4',
    'video/webm',
];

if (!in_array($mimeType, $allowedTypes, true)) {
    http_response_code(415);
    exit;
}

header('Content-Type: ' . $mimeType);
header('Content-Length: ' . (string)filesize($filePath));
header('Cache-Control: public, max-age=86400');
header('X-Content-Type-Options: nosniff');
readfile($filePath);
