<?php
// backend/recover_account.php
require_once 'db.php';
require_once 'security.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$rawData = file_get_contents('php://input');
$data = json_decode($rawData, true);

$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';

if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email and password are required.']);
    exit;
}

try {
    // 1. Fetch the user (we don't need all columns just for recovery validation, but we will need them for the token)
    // We fetch everything just like login.php to return a complete payload after recovery
    
    // Helper to get columns for backward-compat 
    try {
        $columns = $pdo->query("DESCRIBE users")->fetchAll(PDO::FETCH_COLUMN);
        $userColumns = is_array($columns) ? $columns : [];
    } catch (Throwable $e) {
        $userColumns = [];
    }
    
    $selectParts = [
        "id", "name", "email", "password_hash", "phone", "address",
        (in_array('region', $userColumns, true) ? "region" : "NULL AS region"),
        "level", "level_name", "avatar_text", "profile_image",
        (in_array('status', $userColumns, true) ? "status" : "'Active' AS status"),
        (in_array('deleted_at', $userColumns, true) ? "deleted_at" : "NULL AS deleted_at"),
        "role",
        (in_array('is_verified', $userColumns, true) ? "is_verified" : "1 AS is_verified"),
        (in_array('verification_method', $userColumns, true) ? "verification_method" : "'email' AS verification_method"),
        (in_array('email_notif', $userColumns, true) ? "email_notif" : "1 AS email_notif"),
        (in_array('push_notif', $userColumns, true) ? "push_notif" : "1 AS push_notif"),
        (in_array('sms_tracking', $userColumns, true) ? "sms_tracking" : "1 AS sms_tracking"),
        (in_array('theme', $userColumns, true) ? "theme" : "'blue' AS theme"),
        (in_array('loyalty_points', $userColumns, true) ? "loyalty_points" : "0 AS loyalty_points")
    ];

    $stmt = $pdo->prepare("SELECT " . implode(', ', $selectParts) . " FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    $passwordValid = $user && verifyPassword($password, $user['password_hash'], $needsRehash);

    if (!$passwordValid) {
        if (!$user) {
            verifyPassword($password, '$argon2id$v=19$m=65536,t=4,p=1$MmdMckp4N1YwS3B2bU51eQ$RkR0...', $needsRehash);
        }
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid email or password.']);
        exit;
    }

    if ($user['status'] !== 'Deleted' && $user['deleted_at'] === null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'This account does not require recovery. Please login normally.']);
        exit;
    }
    
    // Check if purged
    if ($user['status'] === 'Purged') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'This account has been permanently erased due to data retention policies.']);
        exit;
    }

    // Reactivate the account
    $stmt = $pdo->prepare("UPDATE users SET deleted_at = NULL, status = 'Active' WHERE id = ?");
    $stmt->execute([$user['id']]);

    // Re-fetch the updated user for the payload
    $user['status'] = 'Active';
    $user['deleted_at'] = null;

    // Upgrade hash if necessary
    if ($needsRehash) {
        $newHash = hashPassword($password);
        $updateStmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
        $updateStmt->execute([$newHash, $user['id']]);
    }

    // Generate token and set session
    $token = generateToken($user['id'], $user['role']);
    $cookieName = 'ehub_store_session';

    // Store device fingerprint for admin/staff users
    if (in_array($user['role'], ['admin', 'staff']) && function_exists('generateDeviceFingerprint')) {
        $deviceFingerprint = generateDeviceFingerprint();
        $ipAddress = getClientIP();
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $userAgent = $headers['User-Agent'] ?? $_SERVER['HTTP_USER_AGENT'] ?? '';
        
        try {
            $stmt = $pdo->prepare("INSERT INTO user_sessions (user_id, device_fingerprint, ip_address, user_agent) VALUES (?, ?, ?, ?)");
            $stmt->execute([$user['id'], $deviceFingerprint, $ipAddress, $userAgent]);
        } catch (Exception $e) {
            error_log("Failed to store device fingerprint: " . $e->getMessage());
        }
    }

    $isProd = ($config['APP_ENV'] ?? 'production') === 'production';
    setcookie($cookieName, $token, [
        'expires' => time() + (60 * 60 * 24),
        'path' => '/',
        'domain' => '',
        'secure' => $isProd ? true : (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on'),
        'httponly' => true,
        'samesite' => $isProd ? 'Strict' : 'Lax'
    ]);

    logger('ok', 'AUTH', "User {$user['email']} recovered their account and logged in successfully.");

    require_once __DIR__ . '/auth_login_log.php';
    logSuccessfulAuthLogin($pdo, (int) $user['id'], 'local');

    echo json_encode([
        'success' => true,
        'message' => 'Account successfully restored!',
        'data' => [
            'token' => $token,
            'user' => scrubUser($user)
        ]
    ]);

} catch (PDOException $e) {
    logger('error', 'RECOVERY', "Fatal recovery error for $email: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal Server Error during recovery.']);
}
