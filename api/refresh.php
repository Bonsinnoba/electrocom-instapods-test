<?php
// backend/refresh.php
// Refresh Token Endpoint - exchanges refresh token for new access token

require 'cors_middleware.php';
require_once 'db.php';
require_once 'security.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$headers = function_exists('getallheaders') ? getallheaders() : [];

// Get refresh token from cookie
$refreshToken = $_COOKIE['ehub_refresh_token'] ?? null;

if (!$refreshToken) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Refresh token not found']);
    exit;
}

try {
    // Verify refresh token and get user_id
    $userId = verifyRefreshToken($pdo, $refreshToken);
    
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired refresh token']);
        exit;
    }
    
    // Get user info to generate new access token
    $stmt = $pdo->prepare("SELECT id, role, status FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'User not found']);
        exit;
    }
    
    // Check if user account is active
    if ($user['status'] === 'Suspended' || $user['status'] === 'Deleted') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Account is suspended or deleted']);
        exit;
    }
    
    // Generate new access token (15 minutes)
    $newAccessToken = generateAccessToken($user['id'], $user['role']);
    
    // Optional: Rotate refresh token (generate new one, revoke old)
    // This is a security best practice - if a refresh token is stolen, it can only be used once
    $newRefreshToken = generateRefreshToken();
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $ipAddress = getClientIP();
    $userAgent = $headers['User-Agent'] ?? $_SERVER['HTTP_USER_AGENT'] ?? '';
    
    // Get device fingerprint if available
    $deviceFingerprint = null;
    if (in_array($user['role'], ['admin', 'staff']) && function_exists('generateDeviceFingerprint')) {
        $deviceFingerprint = generateDeviceFingerprint();
    }
    
    // Store new refresh token and revoke old one
    try {
        storeRefreshToken($pdo, $user['id'], $newRefreshToken, $deviceFingerprint, $ipAddress, $userAgent);
        revokeRefreshToken($pdo, $refreshToken);
        
        // Set new refresh token cookie
        $isProd = ($config['APP_ENV'] ?? 'production') === 'production';
        // Use null for domain to allow browser default behavior (fixes cross-port cookie issues in dev)
        $cookieDomain = $isProd ? '' : null;
        setcookie('ehub_refresh_token', $newRefreshToken, [
            'expires' => time() + (60 * 60 * 24 * 7), // 7 days
            'path' => '/',
            'domain' => $cookieDomain,
            'secure' => $isProd ? true : (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on'),
            'httponly' => true,
            'samesite' => $isProd ? 'Strict' : 'Lax'
        ]);
    } catch (Exception $e) {
        error_log("Failed to rotate refresh token: " . $e->getMessage());
        // Continue anyway - still return new access token
    }
    
    logger('ok', 'AUTH', "Token refreshed for user ID: {$userId}");
    
    echo json_encode([
        'success' => true,
        'message' => 'Token refreshed successfully',
        'data' => [
            'access_token' => $newAccessToken
        ]
    ]);
    
} catch (PDOException $e) {
    error_log("Refresh token error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal Server Error']);
}
