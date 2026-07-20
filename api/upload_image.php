<?php
// api/upload_image.php
// Upload and optimize images

require_once 'db.php';
require_once 'security.php';
require_once 'image_optimizer.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

// Must be authenticated
$userId = authenticate($pdo);

// Validate CSRF token
$csrfToken = getCSRFTokenFromRequest();
if (!validateCSRFToken($csrfToken)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Invalid or expired CSRF token.']);
    exit;
}

if (!isset($_FILES['image']) || !is_uploaded_file($_FILES['image']['tmp_name'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'No image uploaded']);
    exit;
}

// Validate file upload
$allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
$maxSize = 10 * 1024 * 1024; // 10MB

$validatedFile = validateFileUpload($_FILES['image'], $allowedMimeTypes, $maxSize);

if (!$validatedFile) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid file. Only JPG, PNG, GIF, and WebP images up to 10MB are allowed.']);
    exit;
}

// Create upload directory if it doesn't exist
$uploadDir = __DIR__ . '/public/uploads/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Generate unique filename
$extension = pathinfo($validatedFile['name'], PATHINFO_EXTENSION);
$filename = uniqid('img_', true) . '.' . $extension;
$destination = $uploadDir . $filename;

// Optimize and save image
try {
    $optimizer = new ImageOptimizer();
    $success = $optimizer->optimize($validatedFile['tmp_name'], $destination, true);
    
    if (!$success) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to optimize image']);
        exit;
    }
    
    // Get the optimized path (might be WebP)
    $optimizedPath = ImageOptimizer::getOptimizedPath($destination);
    $relativePath = str_replace(__DIR__, '', $optimizedPath);
    
    // Remove leading slash if present
    $relativePath = ltrim($relativePath, '/');
    
    echo json_encode([
        'success' => true,
        'message' => 'Image uploaded and optimized successfully',
        'data' => [
            'path' => $relativePath,
            'original_name' => $validatedFile['name'],
            'size' => filesize($optimizedPath),
            'format' => pathinfo($optimizedPath, PATHINFO_EXTENSION)
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Image processing failed: ' . $e->getMessage()]);
    exit;
}
