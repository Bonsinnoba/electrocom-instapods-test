<?php
if (!isset($config) || !is_array($config)) {
    $config = require_once __DIR__ . '/config.php';
}
$appEnv = $config['APP_ENV'] ?? 'production';
$allowedOrigins = $config['ALLOWED_ORIGINS'] ?? [];
$frontendUrl = $config['FRONTEND_URL'] ?? 'http://localhost:5174';

// --- Handle CORS ---
$rawOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
$origin = rtrim($rawOrigin, '/');
// Support both http and https for localhost
$isLocalhost = $origin && preg_match('/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/', $origin);

if ($appEnv === 'development') {
    // In development, be permissive to all origins if one is sent,
    // otherwise fallback to a default local origin.
    header("Access-Control-Allow-Origin: " . ($rawOrigin ?: $frontendUrl));
} else {
    // Production: Strict allowlist - only allow explicitly configured origins
    if ($origin && in_array($origin, $allowedOrigins)) {
        header("Access-Control-Allow-Origin: $rawOrigin");
    } else {
        // In production, if origin is not in allowlist, reject the request
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Origin not allowed']);
        exit;
    }
}

header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Session-Token, X-App-ID, x-app-id, X-CSRF-Token, x-csrf-token, Accept, Origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Max-Age: 86400"); // Cache preflight for 24h
header("Content-Type: application/json; charset=UTF-8");

// Security Headers
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("Strict-Transport-Security: max-age=31536000");

if (isset($_SERVER["REQUEST_METHOD"]) && $_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    header('Content-Type: application/json');
    http_response_code(200);
    exit;
}
