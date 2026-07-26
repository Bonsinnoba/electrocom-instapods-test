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
$appId = $headers['X-App-ID'] ?? $headers['x-app-id'] ?? 'storefront';
$cookieName = ($appId === 'admin') ? 'ehub_admin_refresh_token' : 'ehub_store_refresh_token';

// Get refresh token from cookie — prefer the new app-specific cookie, but fall
// back to the old shared cookie name so sessions started before this change
// (single 'ehub_refresh_token' cookie for both apps) don't get force-logged-out.
$refreshToken = $_COOKIE[$cookieName] ?? $_COOKIE['ehub_refresh_token'] ?? null;

if (!$refreshToken) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Refresh token not found']);
    exit;
}

try {
    // Idle-session policy: 2h for the admin panel, 4h for the storefront.
    // This is enforced here regardless of what the client-side idle timer
    // does, so it can't be bypassed by tampering with frontend JS.
    $idleWindowSeconds = ($appId === 'admin') ? (2 * 60 * 60) : (4 * 60 * 60);

    // Verify refresh token and get user_id
    $userId = verifyRefreshToken($pdo, $refreshToken, $idleWindowSeconds);
    
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
        
        // Set new refresh token cookie under the app-specific name
        $isProd = ($config['APP_ENV'] ?? 'production') === 'production';
        // Use null for domain to allow browser default behavior (fixes cross-port cookie issues in dev)
        $cookieDomain = $isProd ? '' : null;
        $cookieOptions = [
            'path' => '/',
            'domain' => $cookieDomain,
            'secure' => $isProd ? true : (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on'),
            'httponly' => true,
            'samesite' => $isProd ? 'Strict' : 'Lax'
        ];
        setcookie($cookieName, $newRefreshToken, $cookieOptions + ['expires' => time() + (60 * 60 * 24 * 7)]); // 7 days
        // Clear the old shared cookie now that this session has migrated to the app-specific one
        setcookie('ehub_refresh_token', '', $cookieOptions + ['expires' => time() - 3600]);
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
