<?php
// backend/login.php
require_once 'db.php';
require_once 'security.php';
require_once __DIR__ . '/brand_settings.php';

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
    $userColumns = [];
    // Self-heal auth columns for older databases to prevent login query failures.
    try {
        $columns = $pdo->query("DESCRIBE users")->fetchAll(PDO::FETCH_COLUMN);
        $userColumns = is_array($columns) ? $columns : [];
        $requiredColumns = [
            'region' => "ALTER TABLE users ADD COLUMN region VARCHAR(100) DEFAULT NULL AFTER address",
            'status' => "ALTER TABLE users MODIFY COLUMN status ENUM('Active', 'Suspended', 'Deleted', 'Purged') DEFAULT 'Active'",
            'deleted_at' => "ALTER TABLE users ADD COLUMN deleted_at DATETIME DEFAULT NULL AFTER status",
            'is_verified' => "ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE AFTER deleted_at",
            'verification_method' => "ALTER TABLE users ADD COLUMN verification_method ENUM('email', 'sms') DEFAULT 'email' AFTER is_verified",
            'verification_code' => "ALTER TABLE users ADD COLUMN verification_code VARCHAR(10) DEFAULT NULL AFTER verification_method",
            'login_attempts' => "ALTER TABLE users ADD COLUMN login_attempts INT DEFAULT 0 AFTER verification_code",
            'lockout_until' => "ALTER TABLE users ADD COLUMN lockout_until DATETIME DEFAULT NULL AFTER login_attempts",
        ];

        foreach ($requiredColumns as $name => $sql) {
            if (!in_array($name, $columns, true)) {
                $pdo->exec($sql);
            }
        }
        // Re-read columns after potential self-heal attempts.
        $userColumns = $pdo->query("DESCRIBE users")->fetchAll(PDO::FETCH_COLUMN);
    } catch (Throwable $schemaError) {
        // Keep login flow alive; primary query below will surface issues if any remain.
        logger('warn', 'LOGIN', 'Auth schema self-heal warning: ' . $schemaError->getMessage());
    }
    if (empty($userColumns)) {
        try {
            $userColumns = $pdo->query("DESCRIBE users")->fetchAll(PDO::FETCH_COLUMN);
        } catch (Throwable $e) {
            $userColumns = [];
        }
    }

    // Load security settings
    $settings = eh_merged_super_settings();
    
    $maxAttempts = (int)($settings['maxLoginAttempts'] ?? 5);
    $lockoutMins = (int)($settings['lockoutDuration'] ?? 60);
    $rateLimit = (int)($settings['apiRateLimit'] ?? 10); // Specific to login rate limit if desired, or use global

    // 1. Apply Rate Limiting
    checkRateLimit($pdo, $rateLimit, 60, 'login');

    // Fetch user by email with backward-compatible column selection.
    $selectParts = [
        "id",
        "name",
        "email",
        "password_hash",
        "phone",
        "address",
        (in_array('region', $userColumns, true) ? "region" : "NULL AS region"),
        "level",
        "level_name",
        "avatar_text",
        "profile_image",
        (in_array('status', $userColumns, true) ? "status" : "'Active' AS status"),
        (in_array('deleted_at', $userColumns, true) ? "deleted_at" : "NULL AS deleted_at"),
        "role",
        (in_array('is_verified', $userColumns, true) ? "is_verified" : "1 AS is_verified"),
        (in_array('verification_method', $userColumns, true) ? "verification_method" : "'email' AS verification_method"),
        (in_array('email_notif', $userColumns, true) ? "email_notif" : "1 AS email_notif"),
        (in_array('push_notif', $userColumns, true) ? "push_notif" : "1 AS push_notif"),
        (in_array('sms_tracking', $userColumns, true) ? "sms_tracking" : "1 AS sms_tracking"),
        (in_array('theme', $userColumns, true) ? "theme" : "'blue' AS theme"),
        (in_array('loyalty_points', $userColumns, true) ? "loyalty_points" : "0 AS loyalty_points"),
        (in_array('login_attempts', $userColumns, true) ? "login_attempts" : "0 AS login_attempts"),
        (in_array('lockout_until', $userColumns, true) ? "lockout_until" : "NULL AS lockout_until")
    ];
    $stmt = $pdo->prepare("SELECT " . implode(', ', $selectParts) . " FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user) {
        // 1. Check if account is currently locked
        $lockoutUntil = $user['lockout_until'] ?? null;
        if ($lockoutUntil && strtotime($lockoutUntil) > time()) {
            $remaining = ceil((strtotime($lockoutUntil) - time()) / 60);
            http_response_code(403);
            if (ob_get_length()) ob_clean();
            echo json_encode(['success' => false, 'message' => "Account locked due to multiple failed attempts. Please try again in $remaining minutes."]);
            exit;
        }
    }

    // Timing-attack safe login verification
    $passwordValid = $user && verifyPassword($password, $user['password_hash'], $needsRehash);

    if (!$passwordValid) {
        // If user not found, perform dummy verification to match timing
        if (!$user) {
            verifyPassword($password, '$argon2id$v=19$m=65536,t=4,p=1$MmdMckp4N1YwS3B2bU51eQ$RkR0...', $needsRehash);
        }
        // 2. Handle Failed Attempt
        if ($user) {
            $attempts = ($user['login_attempts'] ?? 0) + 1;
            $lockout = null;
            if ($attempts >= $maxAttempts) {
                $lockout = date('Y-m-d H:i:s', time() + ($lockoutMins * 60)); 
                logger('warn', 'SECURITY', "Account locked for {$user['email']} after $maxAttempts failed attempts.");
                
                // Log suspicious activity
                if (function_exists('logSuspiciousActivity')) {
                    logSuspiciousActivity($pdo, $user['id'], 'failed_login_lockout', "Account locked after $maxAttempts failed login attempts", 'high');
                }
                
                // Real-time Admin Alert
                try {
                    $stmt = $pdo->prepare("INSERT INTO notifications (user_id, title, message, type) 
                                           SELECT id, ?, ?, 'error' FROM users WHERE role IN ('store_manager', 'super')");
                    $stmt->execute([
                        "Security Alert: Account Locked", 
                        "User account {$user['email']} has been locked for {$lockoutMins} minutes due to excessive failed attempts."
                    ]);

                    // Real-time SMS Alert
                    try {
                        require_once 'notifications.php';
                        $notifier = new NotificationService();
                        $adminPhones = $pdo->query("SELECT phone FROM users WHERE role = 'super' AND phone IS NOT NULL AND phone != ''")->fetchAll(PDO::FETCH_COLUMN);
                        foreach ($adminPhones as $phone) {
                            $notifier->queueNotification('sms', $phone, "SECURITY ALERT: User account {$user['email']} has been LOCKED due to brute force attempts.");
                        }
                    } catch (Exception $smsErr) {
                        logger('error', 'SECURITY', "Failed to queue lockout SMS: " . $smsErr->getMessage());
                    }
                } catch (Exception $e) {
                    logger('error', 'SECURITY', "Failed to log lockout notification: " . $e->getMessage());
                }
            }
            if (in_array('login_attempts', $userColumns, true) && in_array('lockout_until', $userColumns, true)) {
                $stmt = $pdo->prepare("UPDATE users SET login_attempts = ?, lockout_until = ? WHERE id = ?");
                $stmt->execute([$attempts, $lockout, $user['id']]);
            }
        }

        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid email or password.']);
        exit;
    }

    // 3. Handle Successful Login -> Reset Attempts
    if (in_array('login_attempts', $userColumns, true) && in_array('lockout_until', $userColumns, true)) {
        $stmt = $pdo->prepare("UPDATE users SET login_attempts = 0, lockout_until = NULL WHERE id = ?");
        $stmt->execute([$user['id']]);
    }

    // TRANSPARENT SECURITY UPGRADE:
    // If user logged in via legacy hash, upgrade them to the new peppered format now.
    if ($needsRehash) {
        $newHash = hashPassword($password);
        $updateStmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
        $updateStmt->execute([$newHash, $user['id']]);
        logger('info', 'SECURITY', "Updated legacy password hash for User ID: {$user['id']} to peppered format.");
    }

    if ($user['status'] === 'Deleted' || $user['deleted_at'] !== null) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'recovery_required' => true,
            'message' => 'Your account is scheduled for deletion. Would you like to restore it?',
            'data' => [
                'id' => $user['id'],
                'email' => $user['email']
            ]
        ]);
        exit;
    }

    if ($user['status'] === 'Suspended') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Your account has been suspended. Please contact support.']);
        exit;
    }

    if (!$user['is_verified'] && !in_array($user['role'], RBAC_ALL_ADMINS)) {
        // Generate a new code for the login attempt if one doesn't exist
        // Generate a new code using cryptographically secure randomness
        $newCode = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
        if (in_array('verification_code', $userColumns, true)) {
            $stmt = $pdo->prepare("UPDATE users SET verification_code = ? WHERE id = ?");
            $stmt->execute([$newCode, $user['id']]);
        }

        // Dispatch new code
        require_once 'notifications.php';
        $notifier = new NotificationService();
        $subject = 'Your ' . eh_brand_site_name() . ' Verification Code';
        $msg = "Your verification code is: {$newCode}. Please enter this code to activate your account.";

        if ($user['verification_method'] === 'sms') {
            $notifier->queueNotification('sms', $user['phone'], $msg);
        } else {
            $notifier->queueNotification('email', $user['email'], $msg, $subject);
        }

        http_response_code(403);
        echo json_encode([
            'success' => false,
            'needs_verification' => true,
            'message' => 'Please verify your account to continue. A new code has been sent.',
            'data' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'phone' => $user['phone'],
                'verification_method' => $user['verification_method']
            ]
        ]);
        exit;
    }

    // Generate short-lived access token (15 minutes)
    $accessToken = generateAccessToken($user['id'], $user['role']);
    
    // Generate long-lived refresh token (7 days)
    $refreshToken = generateRefreshToken();
    
    // Identify target application for cookie naming
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $appId = $headers['X-App-ID'] ?? $headers['x-app-id'] ?? ($data['app_source'] ?? 'storefront');
    $cookieName = ($appId === 'admin') ? 'ehub_refresh_token' : 'ehub_refresh_token';

    // Get device info for refresh token storage
    $deviceFingerprint = null;
    $ipAddress = getClientIP();
    $userAgent = $headers['User-Agent'] ?? $_SERVER['HTTP_USER_AGENT'] ?? '';
    
    // Store device fingerprint for admin/staff users
    if (in_array($user['role'], ['admin', 'staff']) && function_exists('generateDeviceFingerprint')) {
        $deviceFingerprint = generateDeviceFingerprint();
        
        try {
            $stmt = $pdo->prepare("INSERT INTO user_sessions (user_id, device_fingerprint, ip_address, user_agent) VALUES (?, ?, ?, ?)");
            $stmt->execute([$user['id'], $deviceFingerprint, $ipAddress, $userAgent]);
        } catch (Exception $e) {
            error_log("Failed to store device fingerprint: " . $e->getMessage());
        }
    }

    // Store refresh token in database
    try {
        storeRefreshToken($pdo, $user['id'], $refreshToken, $deviceFingerprint, $ipAddress, $userAgent);
    } catch (Exception $e) {
        error_log("Failed to store refresh token: " . $e->getMessage());
        // Continue anyway - login should still work
    }

    // Set HttpOnly Cookie for refresh token (7 days)
    $isProd = ($config['APP_ENV'] ?? 'production') === 'production';
    // Use null for domain to allow browser default behavior (fixes cross-port cookie issues in dev)
    $cookieDomain = $isProd ? '' : null;
    setcookie($cookieName, $refreshToken, [
        'expires' => time() + (60 * 60 * 24 * 7), // 7 days
        'path' => '/',
        'domain' => $cookieDomain,
        'secure' => $isProd ? true : (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on'),
        'httponly' => true,
        'samesite' => $isProd ? 'Strict' : 'Lax'
    ]);

    logger('ok', 'AUTH', "User {$user['email']} logged in successfully as " . strtoupper($user['role']));

    require_once __DIR__ . '/auth_login_log.php';
    logSuccessfulAuthLogin($pdo, (int) $user['id'], 'local');

    if (ob_get_length()) ob_clean();
    echo json_encode([
        'success' => true,
        'message' => 'Login successful!',
        'data' => [
            'access_token' => $accessToken, // Short-lived token for memory storage
            'user' => scrubUser($user)
        ]
    ]);
} catch (PDOException $e) {
    if (ob_get_length()) ob_clean();
    logger('error', 'LOGIN', "Fatal login error for $email: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal Server Error during login.']);
}
