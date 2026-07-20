<?php
// Serve static files based on the requested path
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// Serve admin panel
if (strpos($uri, '/admin') === 0) {
    $file = __DIR__ . '/public' . $uri;
    if (file_exists($file) && is_file($file)) {
        $mimeType = getMimeType($file);
        header('Content-Type: ' . $mimeType);
        readfile($file);
        exit;
    }
    // Serve admin index.html for admin routes
    if ($uri === '/admin' || strpos($uri, '/admin/') === 0) {
        header('Content-Type: text/html');
        readfile(__DIR__ . '/public/admin/index.html');
        exit;
    }
}

// Serve API routes
if (strpos($uri, '/api') === 0) {
    $apiFile = __DIR__ . '/api' . substr($uri, 4);
    if (file_exists($apiFile) && is_file($apiFile)) {
        require $apiFile;
        exit;
    }
    // If no specific file, serve api/index.php
    require __DIR__ . '/api/index.php';
    exit;
}

// Serve storefront static files
$file = __DIR__ . '/public' . $uri;
if (file_exists($file) && is_file($file)) {
    $mimeType = getMimeType($file);
    header('Content-Type: ' . $mimeType);
    readfile($file);
    exit;
}

// Serve storefront index.html for all other routes
header('Content-Type: text/html');
readfile(__DIR__ . '/public/index.html');
exit;

function getMimeType($file) {
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $mimeTypes = [
        'js' => 'application/javascript',
        'css' => 'text/css',
        'html' => 'text/html',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
        'eot' => 'application/vnd.ms-fontobject',
    ];
    return $mimeTypes[$ext] ?? 'application/octet-stream';
}
