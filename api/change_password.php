<?php
// api/change_password.php
// Allows an authenticated user to change their own password.

require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');
checkRateLimit($pdo, 10, 3600, 'change_password');

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
    echo json_encode(['success' => false, 'message' => 'Invalid or expired CSRF token. Please refresh the page and try again.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$currentPassword = validateString($data['current_password'] ?? '');
$newPassword     = validateString($data['new_password'] ?? '');

if (empty($currentPassword) || empty($newPassword)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Current password and new password are required.']);
    exit;
}

if (strlen($newPassword) < 8) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'New password must be at least 8 characters long.']);
    exit;
}

try {
    // Verify current password using re-authentication function
    if (!verifyReauthentication($pdo, $userId, $currentPassword, false)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Current password is incorrect.']);
        exit;
    }

    // Fetch stored hash for reuse check
    $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'User not found.']);
        exit;
    }

    // Prevent reuse of the same password
    $needsRehash = false;
    if (verifyPassword($newPassword, $row['password_hash'], $needsRehash)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'New password cannot be the same as your current password.']);
        exit;
    }

    // Hash and update
    $newHash = hashPassword($newPassword);
    $update = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
    $update->execute([$newHash, $userId]);

    logger('info', 'AUTH', "User #{$userId} changed their password successfully.");

    echo json_encode(['success' => true, 'message' => 'Password changed successfully.']);

} catch (PDOException $e) {
    error_log("Change password error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'An internal error occurred. Please try again.']);
}
