<?php
// backend/social_auth_exchange.php
// Exchanges an opaque social_auth code for the actual JWT token.
// Uses file-based storage (not PHP sessions) so the code is readable
// regardless of cross-origin session continuity issues.

require __DIR__ . '/cors_middleware.php';

header('Content-Type: application/json');

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/social_exchange_error.log');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $opaqueCode = trim($input['code'] ?? '');

    if (!$opaqueCode || !ctype_xdigit($opaqueCode) || strlen($opaqueCode) !== 32) {
        error_log("Invalid code format: " . ($opaqueCode ? substr($opaqueCode, 0, 8) . '...' : 'empty'));
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Code is required']);
        exit;
    }

    $tokenFile = __DIR__ . '/data/social_auth_codes.json';

    // Load token store
    $codes = [];
    if (file_exists($tokenFile)) {
        $codes = json_decode(file_get_contents($tokenFile), true) ?: [];
    }

    $now = time();

    // Purge expired codes on every read
    $activeCodes = array_filter($codes, fn($c) => isset($c['expires_at']) && $c['expires_at'] > $now);

    if (!isset($activeCodes[$opaqueCode])) {
        // Persist cleaned store before exiting
        @file_put_contents($tokenFile, json_encode($activeCodes, JSON_PRETTY_PRINT), LOCK_EX);
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired code']);
        exit;
    }

    $authData = $activeCodes[$opaqueCode];

    // Consume the code (one-time use)
    unset($activeCodes[$opaqueCode]);
    @file_put_contents($tokenFile, json_encode($activeCodes, JSON_PRETTY_PRINT), LOCK_EX);

    // Return the token and user data
    echo json_encode([
        'success' => true,
        'data' => [
            'token' => $authData['token'],
            'user'  => $authData['user']
        ]
    ]);
} catch (Exception $e) {
    error_log("Social auth exchange exception: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
}
