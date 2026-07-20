<?php
// backend/verify.php
require_once 'db.php';
require_once 'security.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$rawData = file_get_contents('php://input');
$data = json_decode($rawData, true);

$userId = $data['user_id'] ?? null;
$code = $data['code'] ?? null;

if (!$userId || !$code) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'User ID and verification code are required.']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT verification_code FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'User not found.']);
        exit;
    }

    if ($user['verification_code'] !== $code) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid verification code.']);
        exit;
    }

    // Mark as verified
    $stmt = $pdo->prepare("UPDATE users SET is_verified = 1, verification_code = NULL WHERE id = ?");
    $stmt->execute([$userId]);

    // Fetch full user for login session
    $stmt = $pdo->prepare("SELECT id, name, email, phone, address, level, level_name, avatar_text, profile_image, role, email_notif, push_notif, sms_tracking, theme FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $verifiedUser = $stmt->fetch();

    $token = generateToken($userId, $verifiedUser['role']);

    // Set HttpOnly Cookie for security
    $isProd = ($config['APP_ENV'] ?? 'production') === 'production';
    setcookie('ehub_session', $token, [
        'expires' => time() + (60 * 60 * 24),
        'path' => '/',
        'domain' => '',
        'secure' => $isProd ? true : (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on'),
        'httponly' => true,
        'samesite' => 'Strict'
    ]);

    logger('ok', 'AUTH_VERIFY', "User {$verifiedUser['email']} verified account successfully.");

    echo json_encode([
        'success' => true,
        'message' => 'Account verified successfully!',
        'data' => [
            'token' => $token,
            'user' => [
                'id' => (int)$verifiedUser['id'],
                'name' => $verifiedUser['name'],
                'email' => $verifiedUser['email'],
                'phone' => $verifiedUser['phone'],
                'address' => $verifiedUser['address'],
                'level' => (int)$verifiedUser['level'],
                'levelName' => $verifiedUser['level_name'],
                'avatar' => $verifiedUser['avatar_text'],
                'profileImage' => (strlen($verifiedUser['profile_image'] ?? '') > 50000) ? null : $verifiedUser['profile_image'],
                'role' => $verifiedUser['role'],
                'email_notif' => (bool)($verifiedUser['email_notif'] ?? true),
                'push_notif' => (bool)($verifiedUser['push_notif'] ?? true),
                'sms_tracking' => (bool)($verifiedUser['sms_tracking'] ?? true),
                'theme' => $verifiedUser['theme'] ?? 'blue'
            ]
        ]
    ]);
} catch (PDOException $e) {
    logger('error', 'VERIFY', "Verification failed for User ID ($userId): " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal Server Error during verification.']);
}
