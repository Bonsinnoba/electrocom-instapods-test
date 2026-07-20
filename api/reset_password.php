<?php
// backend/reset_password.php
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$rawData = file_get_contents('php://input');
$data = json_decode($rawData, true);

$email = sanitizeInput($data['email'] ?? '');
$token = $data['token'] ?? '';
$newPassword = $data['password'] ?? '';

if (empty($email) || empty($token) || empty($newPassword)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'All fields are required.']);
    exit;
}

if (strlen($newPassword) < 8) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Password must be at least 8 characters long.']);
    exit;
}

try {
    // Verify token
    $stmt = $pdo->prepare("SELECT id FROM password_resets WHERE email = ? AND token = ? AND expires_at > NOW()");
    $stmt->execute([$email, $token]);
    $resetRequest = $stmt->fetch();

    if (!$resetRequest) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired reset token.']);
        exit;
    }

    // Update user password and mark as verified since they proved ownership
    $newHash = hashPassword($newPassword);
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ?, login_attempts = 0, lockout_until = NULL, is_verified = 1, verification_code = NULL WHERE email = ?");
    $stmt->execute([$newHash, $email]);

    // Delete used token
    $stmt = $pdo->prepare("DELETE FROM password_resets WHERE email = ?");
    $stmt->execute([$email]);

    logger('ok', 'AUTH_RESET', "Password successfully reset for {$email}");

    echo json_encode([
        'success' => true,
        'message' => 'Password has been successfully reset. You can now log in.'
    ]);
} catch (PDOException $e) {
    logger('error', 'PASSWORD_RESET', "Password reset failed for $email: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal Server Error during password reset.']);
}
