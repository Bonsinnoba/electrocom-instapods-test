<?php
/**
 * generate_report_token.php
 * Generates a short-lived, one-time use download token for the staff report.
 */

require 'cors_middleware.php';
require 'db.php';
require 'security.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

try {
    $userId = authenticate($pdo);
    $userRole = getUserRole($userId, $pdo);
    
    $allowedRoles = ['super', 'store_manager', 'accountant'];
    if (!in_array($userRole, $allowedRoles, true)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden: Insufficient permissions.']);
        exit;
    }
    
    $token = bin2hex(random_bytes(16));
    $tokenFile = __DIR__ . '/data/report_tokens.json';
    
    if (!is_dir(__DIR__ . '/data')) {
        mkdir(__DIR__ . '/data', 0755, true);
    }
    
    $tokens = [];
    if (file_exists($tokenFile)) {
        $tokens = json_decode(file_get_contents($tokenFile), true) ?: [];
    }
    
    // Clean expired tokens dynamically
    $now = time();
    $activeTokens = [];
    foreach ($tokens as $t => $meta) {
        if (isset($meta['expires_at']) && $meta['expires_at'] > $now) {
            $activeTokens[$t] = $meta;
        }
    }
    
    // Add new token (valid for 90 seconds)
    $activeTokens[$token] = [
        'user_id' => $userId,
        'role' => $userRole,
        'expires_at' => $now + 90
    ];
    
    file_put_contents($tokenFile, json_encode($activeTokens, JSON_PRETTY_PRINT));
    
    echo json_encode(['success' => true, 'dl_token' => $token]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server Error: ' . $e->getMessage()]);
}
