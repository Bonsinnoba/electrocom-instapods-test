<?php
// backend/security.php
// Security Utilities and Middleware

// Standardized RBAC Role Groups
if (!defined('RBAC_ADMIN_GROUP')) {
    define('RBAC_ADMIN_GROUP', ['store_manager', 'marketing', 'accountant', 'picker']);
}
if (!defined('RBAC_STAFF_GROUP')) {
    define('RBAC_STAFF_GROUP', ['pos_cashier', 'store_manager', 'picker']);
}
if (!defined('RBAC_SUPER_GROUP')) {
    define('RBAC_SUPER_GROUP', ['super']);
}
if (!defined('RBAC_ALL_ADMINS')) {
    define('RBAC_ALL_ADMINS', array_merge(RBAC_ADMIN_GROUP, RBAC_SUPER_GROUP));
}

/**
 * Hash a password using Argon2id with a server-side pepper.
 */
if (!function_exists('hashPassword')) {
    function hashPassword(string $password)
    {
        $config = $GLOBALS['config'] ?? require_once 'config.php';
        $pepper = $config['PASSWORD_PEPPER'] ?? '';
        return password_hash($password . $pepper, PASSWORD_ARGON2ID);
    }
}

/**
 * Verify a password against a hash.
 */
if (!function_exists('verifyPassword')) {
    function verifyPassword(string $password, string $hash, &$needsRehash = false)
    {
        $config = $GLOBALS['config'] ?? require_once 'config.php';
        $pepper = $config['PASSWORD_PEPPER'] ?? '';
        if (password_verify($password . $pepper, $hash)) {
            $needsRehash = false;
            return true;
        }
        if (password_verify($password, $hash)) {
            $needsRehash = true;
            return true;
        }
        return false;
    }
}

/**
 * Sanitize input to prevent XSS
 */
if (!function_exists('sanitizeXSS')) {
    function sanitizeXSS(mixed $data)
    {
        if ($data === null) return null;
        if (is_array($data)) {
            return array_map('sanitizeXSS', $data);
        }
        return htmlspecialchars(trim((string)$data), ENT_QUOTES, 'UTF-8');
    }
}

/**
 * Legacy alias for sanitizeXSS for backward compatibility
 */
if (!function_exists('sanitizeInput')) {
    function sanitizeInput(mixed $data)
    {
        return sanitizeXSS($data);
    }
}

/**
 * Validate integer input with range check
 */
if (!function_exists('validateInt')) {
    function validateInt(mixed $value, int $min = PHP_INT_MIN, int $max = PHP_INT_MAX): ?int
    {
        if ($value === null || $value === '') return null;
        $intVal = filter_var($value, FILTER_VALIDATE_INT);
        if ($intVal === false) return null;
        if ($intVal < $min || $intVal > $max) return null;
        return $intVal;
    }
}

/**
 * Validate float input with range check
 */
if (!function_exists('validateFloat')) {
    function validateFloat(mixed $value, float $min = -INF, float $max = INF): ?float
    {
        if ($value === null || $value === '') return null;
        $floatVal = filter_var($value, FILTER_VALIDATE_FLOAT);
        if ($floatVal === false) return null;
        if ($floatVal < $min || $floatVal > $max) return null;
        return $floatVal;
    }
}

/**
 * Validate email format
 */
if (!function_exists('validateEmail')) {
    function validateEmail(mixed $value): ?string
    {
        if ($value === null || $value === '') return null;
        $email = filter_var($value, FILTER_VALIDATE_EMAIL);
        if ($email === false) return null;
        return $email;
    }
}

/**
 * Validate string with length limits
 */
if (!function_exists('validateString')) {
    function validateString(mixed $value, int $minLength = 0, int $maxLength = 255): ?string
    {
        if ($value === null || $value === '') return null;
        $str = trim((string)$value);
        $len = mb_strlen($str, 'UTF-8');
        if ($len < $minLength || $len > $maxLength) return null;
        return $str;
    }
}

/**
 * Validate enum value against allowed values
 */
if (!function_exists('validateEnum')) {
    function validateEnum(mixed $value, array $allowedValues): ?string
    {
        if ($value === null || $value === '') return null;
        $str = (string)$value;
        if (!in_array($str, $allowedValues, true)) return null;
        return $str;
    }
}

/**
 * Validate URL format
 */
if (!function_exists('validateUrl')) {
    function validateUrl(mixed $value): ?string
    {
        if ($value === null || $value === '') return null;
        $url = filter_var($value, FILTER_VALIDATE_URL);
        if ($url === false) return null;
        return $url;
    }
}

/**
 * Validate and sanitize file upload
 */
if (!function_exists('validateFileUpload')) {
    function validateFileUpload(array $file, array $allowedMimeTypes = [], int $maxSize = 5242880): ?array
    {
        if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            return null;
        }

        // Check file size
        $fileSize = filesize($file['tmp_name']);
        if ($fileSize === false || $fileSize > $maxSize) {
            return null;
        }

        // Check MIME type
        if (!empty($allowedMimeTypes)) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mimeType = finfo_file($finfo, $file['tmp_name']);
            finfo_close($finfo);

            if (!in_array($mimeType, $allowedMimeTypes, true)) {
                return null;
            }
        }

        // Check for common file upload attacks
        $fileName = basename($file['name']);
        if (preg_match('/\.(php|phtml|php3|php4|php5|php7|phps|js|jsp|asp|aspx|exe|sh|bat|cmd|cgi|pl)$/i', $fileName)) {
            return null;
        }

        return [
            'tmp_name' => $file['tmp_name'],
            'name' => $fileName,
            'size' => $fileSize,
            'type' => $mimeType ?? $file['type'] ?? 'application/octet-stream'
        ];
    }
}

/**
 * Validate Email Format
 */
if (!function_exists('isValidEmail')) {
    function isValidEmail(string $email)
    {
        return filter_var($email, FILTER_VALIDATE_EMAIL);
    }
}

/**
 * AES-256-CBC Encryption
 */
if (!function_exists('encryptData')) {
    function encryptData(string $plaintext)
    {
        $config = $GLOBALS['config'] ?? require_once 'config.php';
        $key = $config['DATA_ENCRYPTION_KEY'] ?? '';
        if (!$key) return $plaintext;
        $iv = openssl_random_pseudo_bytes(16);
        $ciphertext = openssl_encrypt($plaintext, 'AES-256-CBC', substr(hash('sha256', $key, true), 0, 32), OPENSSL_RAW_DATA, $iv);
        return base64_encode($iv . $ciphertext);
    }
}

/**
 * Helper to get user IP with proxy support
 */
if (!function_exists('getClientIP')) {
    function getClientIP()
    {
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            return trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
        }
        return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }
}

if (!function_exists('decryptData')) {
    function decryptData(string $ciphertext)
    {
        $config = $GLOBALS['config'] ?? require_once 'config.php';
        $key = $config['DATA_ENCRYPTION_KEY'] ?? '';
        if (!$key) return $ciphertext;
        $data = base64_decode($ciphertext);
        if ($data === false || strlen($data) < 16) return '';
        $iv = substr($data, 0, 16);
        $raw = substr($data, 16);
        $plaintext = openssl_decrypt($raw, 'AES-256-CBC', substr(hash('sha256', $key, true), 0, 32), OPENSSL_RAW_DATA, $iv);
        return $plaintext === false ? '' : $plaintext;
    }
}

/**
 * Generate JWT Token
 * Minimal payload: only user_id and role to reduce token size
 * Role-based expiration: admin=4h, storefront=2h
 */
if (!function_exists('generateToken')) {
    function generateToken(int $userId, string $role = 'customer')
    {
        $config = $GLOBALS['config'] ?? require_once 'config.php';
        $secret = $config['JWT_SECRET'];
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        
        // Role-based expiration: admin/staff get 4h, customers get 2h
        $isAdmin = in_array($role, ['admin', 'staff']);
        $expirationHours = $isAdmin ? 4 : 2;
        
        $payload = json_encode([
            'user_id' => $userId,
            'role' => $role,
            'exp' => time() + (60 * 60 * $expirationHours),
            'iat' => time()
        ]);
        $b64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
        $b64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
        $sig = hash_hmac('sha256', "$b64Header.$b64Payload", $secret, true);
        $b64Sig = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($sig));
        return "$b64Header.$b64Payload.$b64Sig";
    }
}

/**
 * Polyfill for getallheaders() if missing (common in php -S or FastCGI)
 */
if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
            }
        }
        return $headers;
    }
}

/**
 * Generate Device Fingerprint from Request Headers
 * Used for admin panel security only (not storefront)
 */
if (!function_exists('generateDeviceFingerprint')) {
    function generateDeviceFingerprint()
    {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        
        // Collect stable device characteristics
        $fingerprintData = [
            'user-agent' => $headers['User-Agent'] ?? $_SERVER['HTTP_USER_AGENT'] ?? '',
            'accept-language' => $headers['Accept-Language'] ?? $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '',
            'accept-encoding' => $headers['Accept-Encoding'] ?? $_SERVER['HTTP_ACCEPT_ENCODING'] ?? '',
            'sec-ch-ua' => $headers['Sec-Ch-Ua'] ?? '',
            'sec-ch-ua-platform' => $headers['Sec-Ch-Ua-Platform'] ?? '',
            'sec-ch-ua-mobile' => $headers['Sec-Ch-Ua-Mobile'] ?? '',
        ];
        
        // Hash the fingerprint data
        return hash('sha256', json_encode($fingerprintData));
    }
}

/**
 * Log Suspicious Activity
 * Records security events for monitoring and analysis
 */
if (!function_exists('logSuspiciousActivity')) {
    function logSuspiciousActivity(?PDO $pdo, ?int $userId, string $activityType, string $description, string $severity = 'medium')
    {
        if (!$pdo) return;
        
        try {
            $ipAddress = getClientIP();
            $stmt = $pdo->prepare("INSERT INTO suspicious_activity (user_id, ip_address, activity_type, description, severity) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$userId, $ipAddress, $activityType, $description, $severity]);
            
            if (function_exists('logApp')) {
                logApp('warn', 'SUSPICIOUS', "$activityType: $description | User: $userId | IP: $ipAddress | Severity: $severity");
            }
        } catch (Exception $e) {
            error_log("Failed to log suspicious activity: " . $e->getMessage());
        }
    }
}

/**
 * Check for Suspicious Activity
 * Returns true if activity threshold is exceeded
 */
if (!function_exists('checkSuspiciousActivity')) {
    function checkSuspiciousActivity(?PDO $pdo, string $ipAddress, ?int $userId = null, int $threshold = 5, int $timeWindowMinutes = 15)
    {
        if (!$pdo) return false;
        
        try {
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as count 
                FROM suspicious_activity 
                WHERE ip_address = ? 
                AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
                " . ($userId ? "AND user_id = ?" : "")
            );
            
            if ($userId) {
                $stmt->execute([$ipAddress, $timeWindowMinutes, $userId]);
            } else {
                $stmt->execute([$ipAddress, $timeWindowMinutes]);
            }
            
            $result = $stmt->fetch();
            return ($result['count'] ?? 0) >= $threshold;
        } catch (Exception $e) {
            error_log("Failed to check suspicious activity: " . $e->getMessage());
            return false;
        }
    }
}

/**
 * Verify Re-authentication for Critical Actions
 * Requires password confirmation for sensitive operations
 */
if (!function_exists('verifyReauthentication')) {
    function verifyReauthentication(?PDO $pdo, int $userId, string $password, bool $dieOnError = true)
    {
        if (!$pdo) {
            if ($dieOnError) {
                header('Content-Type: application/json');
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Database connection required for re-authentication.']);
                exit;
            }
            return false;
        }
        
        try {
            $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            
            if (!$user) {
                if ($dieOnError) {
                    header('Content-Type: application/json');
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'User not found.']);
                    exit;
                }
                return false;
            }
            
            $isValid = verifyPassword($password, $user['password_hash']);
            
            if (!$isValid) {
                logSuspiciousActivity($pdo, $userId, 'reauth_failed', 'Failed re-authentication for critical action', 'medium');
                if ($dieOnError) {
                    header('Content-Type: application/json');
                    http_response_code(401);
                    echo json_encode(['success' => false, 'message' => 'Invalid password. Please confirm your identity.']);
                    exit;
                }
                return false;
            }
            
            return true;
        } catch (Exception $e) {
            error_log("Re-authentication verification error: " . $e->getMessage());
            if ($dieOnError) {
                header('Content-Type: application/json');
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Authentication verification failed.']);
                exit;
            }
            return false;
        }
    }
}

/**
 * Authenticate Request
 */
if (!function_exists('authenticate')) {
    function authenticate(?PDO $pdo = null, bool $dieOnError = true)
    {
        // EMERGENCY DEBUG LOG - Log raw request data to catch hidden session drops
        // Only enabled in development mode to prevent exposing sensitive tokens in production
        if (function_exists('isDebugEnabled') && isDebugEnabled()) {
            if (!is_dir(__DIR__ . '/logs')) mkdir(__DIR__ . '/logs', 0755, true);
            $debugHeaders = function_exists('getallheaders') ? getallheaders() : [];
            $debugLog = date('Y-m-d H:i:s') . " | AUTH_REQ | " . $_SERVER['REQUEST_METHOD'] . " " . $_SERVER['REQUEST_URI'] . " | IP: " . getClientIP() . " | AuthHeader: " . ($debugHeaders['Authorization'] ?? $debugHeaders['authorization'] ?? 'NONE') . " | Cookie: " . ($_COOKIE['ehub_session'] ?? 'NONE') . "\n";
            file_put_contents(__DIR__ . '/logs/debug_auth.log', $debugLog, FILE_APPEND);
        }

        $token = null;
        $headers = function_exists('getallheaders') ? getallheaders() : [];

        // 0. Identify the calling application for cookie selection
        $appId = $headers['X-App-ID'] ?? $headers['x-app-id'] ?? null;

        // 1. Explicit Headers (Highest priority to prevent cross-app local HTTP cookie contamination)
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
        if ($authHeader && preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            $token = $matches[1];
        }

        if (!$token) {
            $token = $headers['X-Session-Token'] ?? $headers['x-session-token'] ?? null;
        }

        // 1.5. Query Parameter Fallback (Useful for direct file downloads / print links)
        if (!$token && !empty($_GET['token'])) {
            $token = $_GET['token'];
            if (!$appId) {
                $appId = 'storefront';
            }
        }

        // 2. Isolated Cookie Check
        if (!$token) {
            if ($appId === 'admin') {
                $token = $_COOKIE['ehub_admin_session'] ?? null;
            } elseif ($appId === 'storefront') {
                $token = $_COOKIE['ehub_store_session'] ?? null;
            }
            
            // Fallback for transition or missing headers
            if (!$token) {
                $token = $_COOKIE['ehub_session'] ?? null;
            }
        }

        if (!$token) {
            if (function_exists('logApp')) logApp('error', 'AUTH', "AUTH FAIL: No token found. App-ID: $appId | Headers: " . json_encode($headers));
            if ($dieOnError) {
                header('Content-Type: application/json');
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized: Missing or invalid token.']);
                exit;
            }
            return null;
        }

        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            if (function_exists('logApp')) logApp('error', 'AUTH', "AUTH FAIL: Invalid token format. Token parts count: " . count($parts));
            if ($dieOnError) {
                header('Content-Type: application/json');
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized: Invalid token format.']);
                exit;
            }
            return null;
        }

        // SECURITY FIX: Verify Signature
        $config = $GLOBALS['config'] ?? require_once 'config.php';
        $secret = $config['JWT_SECRET'];
        $headerAndPayload = $parts[0] . '.' . $parts[1];
        
        // Re-calculate signature
        $expectedSig = hash_hmac('sha256', $headerAndPayload, $secret, true);
        $encodedSig = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($expectedSig));

        if (!hash_equals($encodedSig, $parts[2])) {
            if (function_exists('logApp')) logApp('error', 'AUTH', "AUTH FAIL: Invalid token signature. Header+Payload: " . $headerAndPayload);
            if ($dieOnError) {
                header('Content-Type: application/json');
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized: Invalid token signature.']);
                exit;
            }
            return null;
        }

        // Check if token has been revoked (blacklist check)
        if ($pdo) {
            try {
                $tokenSignature = $parts[2];
                $revokeCheck = $pdo->prepare("SELECT id FROM revoked_tokens WHERE token_signature = ? AND expires_at > NOW() LIMIT 1");
                $revokeCheck->execute([$tokenSignature]);
                if ($revokeCheck->fetch()) {
                    if (function_exists('logApp')) logApp('error', 'AUTH', "AUTH FAIL: Token has been revoked (blacklisted).");
                    if ($dieOnError) {
                        header('Content-Type: application/json');
                        http_response_code(401);
                        echo json_encode(['success' => false, 'message' => 'Unauthorized: Token has been revoked. Please log in again.']);
                        exit;
                    }
                    return null;
                }
            } catch (Exception $e) {
                // Log error but continue - don't block auth if blacklist check fails
                error_log("Token blacklist check error: " . $e->getMessage());
            }
        }

        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[1])), true);

        if (isset($payload['exp']) && $payload['exp'] < time()) {
            if (function_exists('logApp')) logApp('error', 'AUTH', "AUTH FAIL: Token expired.");
            clearSession();
            if ($dieOnError) {
                header('Content-Type: application/json');
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized: Token expired.']);
                exit;
            }
            return null;
        }

        $userId = $payload['user_id'] ?? null;
        $role = $payload['role'] ?? 'customer';

        // Device fingerprint validation for admin panel only (not storefront).
        // Skip for check_user_status.php: the JWT signature is already cryptographic
        // proof of identity, and background fetch requests may omit optional browser
        // headers (Sec-CH-UA, etc.), causing spurious mismatches immediately after refresh.
        $currentScript = basename($_SERVER['SCRIPT_NAME'] ?? '');
        $skipFingerprintScripts = ['check_user_status.php', 'refresh.php'];
        
        if ($appId === 'admin' && $pdo && in_array($role, ['admin', 'staff', 'super']) && !in_array($currentScript, $skipFingerprintScripts)) {
            $currentFingerprint = generateDeviceFingerprint();
            
            try {
                // Query refresh_tokens (maintained by the refresh flow) rather than
                // user_sessions (legacy table not updated by the new token rotation flow).
                $stmt = $pdo->prepare("
                    SELECT device_fingerprint 
                    FROM refresh_tokens 
                    WHERE user_id = ? AND is_revoked = FALSE 
                    ORDER BY created_at DESC 
                    LIMIT 1
                ");
                $stmt->execute([$userId]);
                $rtRecord = $stmt->fetch();
                
                if ($rtRecord && $rtRecord['device_fingerprint'] && $rtRecord['device_fingerprint'] !== $currentFingerprint) {
                    if (function_exists('logApp')) {
                        logApp('warn', 'AUTH_DEVICE', "Device fingerprint mismatch for admin user $userId. Possible session hijack.");
                    }
                    logSuspiciousActivity($pdo, $userId, 'device_fingerprint_mismatch', 'Device fingerprint mismatch detected during authentication', 'high');
                    if ($dieOnError) {
                        header('Content-Type: application/json');
                        http_response_code(401);
                        echo json_encode(['success' => false, 'message' => 'Security Alert: Device change detected. Please log in again.']);
                        exit;
                    }
                    return null;
                }
            } catch (Exception $e) {
                // Log error but don't block auth if fingerprint check fails
                error_log("Device fingerprint check error: " . $e->getMessage());
            }
        }

        // If PDO is available, verify the user actually exists and is not suspended
        if ($userId && $pdo) {
            $stmt = $pdo->prepare("SELECT id, status, role FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();

            if (!$user) {
                if (function_exists('logApp')) logApp('error', 'AUTH', "AUTH FAIL: User ID $userId no longer exists.");
                clearSession();
                if ($dieOnError) {
                    header('Content-Type: application/json');
                    http_response_code(401);
                    echo json_encode(['success' => false, 'message' => 'Account no longer exists. Please log in again.']);
                    exit;
                }
                return null;
            }

            if (($user['status'] ?? '') === 'Suspended') {
                if (function_exists('logApp')) logApp('warn', 'AUTH', "AUTH BLOCKED: User ID $userId is suspended.");
                clearSession();
                if ($dieOnError) {
                    header('Content-Type: application/json');
                    http_response_code(403);
                    echo json_encode(['success' => false, 'message' => 'Your account has been suspended. Please contact support.']);
                    exit;
                }
                return null;
            }
        }

        return $userId;
    }
}

/**
 * Clear the session cookie
 */
if (!function_exists('clearSession')) {
    function clearSession() {
        $isProd = ($GLOBALS['config']['APP_ENV'] ?? 'production') === 'production';
        $cookieParams = [
            'expires' => time() - 3600,
            'path' => '/',
            'domain' => '',
            'secure' => $isProd ? true : (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on'),
            'httponly' => true,
            'samesite' => $isProd ? 'Strict' : 'Lax'
        ];
        
        // Clear all possible session cookies to ensure clean isolation
        setcookie('ehub_session', '', $cookieParams);
        setcookie('ehub_admin_session', '', $cookieParams);
        setcookie('ehub_store_session', '', $cookieParams);
        setcookie('ehub_refresh_token', '', $cookieParams);
    }
}

/**
 * Get User Role
 */
if (!function_exists('getUserRole')) {
    function getUserRole(int $userId, PDO $pdo)
    {
        $stmt = $pdo->prepare("SELECT role, status FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        if (!$row) return null;
        if ($row['status'] === 'Suspended') {
            header('Content-Type: application/json');
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Your account has been suspended.']);
            exit;
        }
        return $row['role'];
    }
}


/**
 * Get User Name
 */
if (!function_exists('getUserName')) {
    function getUserName(int $userId, PDO $pdo)
    {
        $stmt = $pdo->prepare("SELECT name FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        return $row ? $row['name'] : 'System';
    }
}

/**
 * Admin audit trail logger for critical mutations.
 */
if (!function_exists('logAdminAudit')) {
    function logAdminAudit(PDO $pdo, int $actorUserId, string $action, string $entityType, $entityId = null, $changes = null)
    {
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS admin_audit_logs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                actor_user_id INT NOT NULL,
                actor_role VARCHAR(50) DEFAULT NULL,
                action VARCHAR(120) NOT NULL,
                entity_type VARCHAR(80) NOT NULL,
                entity_id VARCHAR(120) DEFAULT NULL,
                changes_json JSON DEFAULT NULL,
                ip_address VARCHAR(45) DEFAULT NULL,
                user_agent VARCHAR(255) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_actor_created (actor_user_id, created_at),
                INDEX idx_entity (entity_type, entity_id)
            )");

            $role = getUserRole($actorUserId, $pdo);
            $ip = getClientIP();
            $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);
            $changesJson = $changes !== null ? json_encode($changes) : null;

            $stmt = $pdo->prepare("INSERT INTO admin_audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, changes_json, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                (int)$actorUserId,
                $role,
                (string)$action,
                (string)$entityType,
                $entityId !== null ? (string)$entityId : null,
                $changesJson,
                $ip,
                $ua
            ]);
        } catch (Throwable $e) {
            if (function_exists('logger')) {
                logger('error', 'AUDIT', 'Failed to write audit log: ' . $e->getMessage());
            }
        }
    }
}


/**
 * Check if Super Admin (non-blocking)
 */
if (!function_exists('isSuperAdmin')) {
    function isSuperAdmin(PDO $pdo)
    {
        $token = $_COOKIE['ehub_session'] ?? null;

        if (!$token) {
            $headers = getallheaders();
            $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
            if ($authHeader && preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
                $token = $matches[1];
            }
            // Also check X-Session-Token (matches cors_middleware.php)
            if (!$token) {
                $token = $headers['X-Session-Token'] ?? $headers['x-session-token'] ?? null;
            }
        }

        if (!$token) return false;

        $parts = explode('.', $token);
        if (count($parts) !== 3) return false;
        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[1])), true);
        if (!$payload || !isset($payload['user_id'])) return false;
        if (isset($payload['exp']) && $payload['exp'] < time()) return false;
        return getUserRole($payload['user_id'], $pdo) === 'super';
    }
}

/**
 * Get User Details including Branch
 */
if (!function_exists('getUserDetails')) {
    function getUserDetails(int $userId, PDO $pdo)
    {
        $stmt = $pdo->prepare("SELECT id, name as username, role FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}


/**
 * Require Role
 */
if (!function_exists('requireRole')) {
    function requireRole(string|array $roles, PDO $pdo)
    {
        $userId = authenticate();
        $role = getUserRole($userId, $pdo);
        if (!is_array($roles)) $roles = [$roles];
        if ($role === 'super' || in_array($role, $roles)) return $userId;
        header('Content-Type: application/json');
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden.']);
        exit;
    }
}

/**
 * Logger
 */
if (!function_exists('logger')) {
    function logger(string $level, string $source, string $message)
    {
        static $isLogging = false;
        if ($isLogging) return; 
        $isLogging = true;

        $level = strtolower($level);
        if ($level === 'info' && function_exists('isDebugEnabled') && !isDebugEnabled()) {
            $isLogging = false;
            return;
        }

        $logDir = __DIR__ . '/logs';
        if (!is_dir($logDir)) mkdir($logDir, 0755, true);
        
        // 1. Context Extraction
        $userIdCtx = '';
        $token = null;
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
        if ($authHeader && preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            $token = $matches[1];
        } elseif (isset($_COOKIE['ehub_session'])) {
            $token = $_COOKIE['ehub_session'];
        }

        if ($token) {
            $parts = explode('.', $token);
            if (count($parts) === 3) {
                $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[1])), true);
                if (isset($payload['user_id'])) {
                    $userIdCtx = " [UID:{$payload['user_id']}]";
                }
            }
        }

        $method = $_SERVER['REQUEST_METHOD'] ?? 'CLI';
        $uri    = $_SERVER['REQUEST_URI'] ?? 'n/a';
        $ip     = getClientIP();

        // 2. Format Line
        // Format: YYYY-MM-DD HH:MM:SS [LEVEL] [SOURCE] [METHOD URI] [IP] [UID:X] message
        $ts = date('Y-m-d H:i:s');
        $lvl = strtoupper($level);
        $src = strtoupper($source);
        $line = "$ts [$lvl] [$src] [$method $uri] [$ip]$userIdCtx $message" . PHP_EOL;

        // 3. Reliable Write with Locking
        $dailyFile = $logDir . '/app-' . date('Y-m-d') . '.log';
        file_put_contents($dailyFile, $line, FILE_APPEND | LOCK_EX);
        
        $isLogging = false;
    }
}

/**
 * Rate Limiter
 * $limit: request count per window
 * $window: time window in seconds (e.g., 60 for minute, 3600 for hour)
 */
if (!function_exists('checkRateLimit')) {
    function checkRateLimit(PDO $pdo, int $limit = 300, int $window = 60, string $action = 'default')
    {
        // 1. Dynamic Table Self-Healing / Migration from legacy ip_address column to rate_key
        try {
            // Check if legacy table exists with ip_address column
            $colCheck = $pdo->query("SHOW COLUMNS FROM api_rate_limits LIKE 'ip_address'")->fetch();
            if ($colCheck) {
                // Drop legacy table to transition to rate_key schema cleanly
                $pdo->exec("DROP TABLE api_rate_limits");
            }
        } catch (Exception $e) {}

        // Create new session-compatible rate limits table
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS api_rate_limits (
                rate_key VARCHAR(100) NOT NULL,
                action VARCHAR(50) DEFAULT 'default',
                request_count INT DEFAULT 1,
                last_request TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (rate_key, action)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        } catch (Exception $e) {}

        // 2. Identify the rate limiting key: User Session or Guest IP
        $ip = getClientIP();
        $rateKey = $ip; // Default fallback

        try {
            $token = null;
            $headers = function_exists('getallheaders') ? getallheaders() : [];
            $appId = $headers['X-App-ID'] ?? $headers['x-app-id'] ?? null;

            // Extract Token from Authorization Header, custom Header, or Cookies
            $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
            if ($authHeader && preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
                $token = $matches[1];
            }

            if (!$token) {
                $token = $headers['X-Session-Token'] ?? $headers['x-session-token'] ?? null;
            }

            if (!$token) {
                if ($appId === 'admin') {
                    $token = $_COOKIE['ehub_admin_session'] ?? null;
                } elseif ($appId === 'storefront') {
                    $token = $_COOKIE['ehub_store_session'] ?? null;
                }
                if (!$token) {
                    $token = $_COOKIE['ehub_session'] ?? null;
                }
            }

            // Cryptographically verify token signature before using it for rate limiting
            if ($token) {
                $parts = explode('.', $token);
                if (count($parts) === 3) {
                    $config = $GLOBALS['config'] ?? require 'config.php';
                    $secret = $config['JWT_SECRET'] ?? '';
                    $headerAndPayload = $parts[0] . '.' . $parts[1];
                    
                    $expectedSig = hash_hmac('sha256', $headerAndPayload, $secret, true);
                    $encodedSig = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($expectedSig));
                    
                    if (hash_equals($encodedSig, $parts[2])) {
                        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[1])), true);
                        $userId = $payload['user_id'] ?? null;
                        if ($userId && (!isset($payload['exp']) || $payload['exp'] > time())) {
                            $rateKey = "user_id:" . $userId;
                        }
                    }
                }
            }
        } catch (Exception $tokenErr) {
            // Ignore token parsing exceptions, default back to IP rate key
        }

        try {
            $stmt = $pdo->prepare("SELECT request_count, last_request FROM api_rate_limits WHERE rate_key = ? AND action = ?");
            $stmt->execute([$rateKey, $action]);
            $row = $stmt->fetch();
            
            if ($row) {
                $lastTime = strtotime($row['last_request']);
                // Check if we are still within the same window since the last request
                if (time() - $lastTime < $window) {
                    if ($row['request_count'] >= $limit) {
                        // Real-time Brute Force Alert for login failures
                        if ($action === 'login' && $row['request_count'] == $limit) {
                            try {
                                $stmt = $pdo->prepare("INSERT INTO notifications (user_id, title, message, type) 
                                                       SELECT id, ?, ?, 'error' FROM users WHERE role IN ('store_manager', 'super')");
                                $stmt->execute([
                                    "Security Alert: Brute Force Attempt", 
                                    "System has blocked key/IP {$rateKey} after too many login attempts. Action: {$action}."
                                ]);

                                // Real-time SMS Alert
                                try {
                                    require_once 'notifications.php';
                                    $notifier = new NotificationService();
                                    $adminPhones = $pdo->query("SELECT phone FROM users WHERE role = 'super' AND phone IS NOT NULL AND phone != ''")->fetchAll(PDO::FETCH_COLUMN);
                                    foreach ($adminPhones as $phone) {
                                        $notifier->queueNotification('sms', $phone, "SECURITY ALERT: Brute force attempt blocked from key {$rateKey} on ElectrCom.");
                                    }
                                } catch (Exception $smsErr) {
                                    logger('error', 'SECURITY', "Failed to queue SMS alert: " . $smsErr->getMessage());
                                }

                                logger('warn', 'SECURITY', "Admin alerted for brute force attempt from key: {$rateKey}");
                            } catch (Exception $e) {
                                logger('error', 'SECURITY', "Failed to log security notification: " . $e->getMessage());
                            }
                        }

                        header('Content-Type: application/json');
                        http_response_code(429);
                        $remainingSeconds = max(0, $window - (time() - $lastTime));
                        $unit = ($window >= 3600) ? 'hour' : 'minute';
                        $waitLabel = ($remainingSeconds >= 60) ? ceil($remainingSeconds / 60) . ' minutes' : $remainingSeconds . ' seconds';
                        
                        echo json_encode([
                            'success' => false, 
                            'message' => "Too many attempts ($limit per $unit). Please wait about $waitLabel."
                        ]);
                        exit;
                    }
                    $pdo->prepare("UPDATE api_rate_limits SET request_count = request_count + 1, last_request = CURRENT_TIMESTAMP WHERE rate_key = ? AND action = ?")->execute([$rateKey, $action]);
                } else {
                    // Reset if the window has passed since the last attempt
                    $pdo->prepare("UPDATE api_rate_limits SET request_count = 1, last_request = CURRENT_TIMESTAMP WHERE rate_key = ? AND action = ?")->execute([$rateKey, $action]);
                }
            } else {
                $pdo->prepare("INSERT INTO api_rate_limits (rate_key, action, request_count, last_request) VALUES (?, ?, 1, CURRENT_TIMESTAMP)")->execute([$rateKey, $action]);
            }
        } catch (Exception $e) {
            if (function_exists('logger')) logger('error', 'SECURITY', "Rate limit error: " . $e->getMessage());
        }
    }
}

/**
 * Maintenance Mode Check
 */
if (!function_exists('checkMaintenanceMode')) {
    function checkMaintenanceMode(PDO $pdo)
    {
        $settingsFile = __DIR__ . '/data/super_settings.json';
        if (file_exists($settingsFile)) {
            $settings = json_decode(file_get_contents($settingsFile), true);
            if (isset($settings['maintenanceMode']) && $settings['maintenanceMode'] === true) {
                if (isSuperAdmin($pdo)) return;
                $script = basename($_SERVER['SCRIPT_NAME']);
                if (in_array($script, ['super_settings.php', 'login.php', 'get_site_settings.php'])) return;
                header('Content-Type: application/json');
                http_response_code(503);
                echo json_encode(['success' => false, 'maintenance' => true, 'message' => 'Under maintenance.']);
                exit;
            }
        }
    }
}

/**
 * Generate CSRF Token
 */
if (!function_exists('generateCSRFToken')) {
    function generateCSRFToken(): string
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        $token = bin2hex(random_bytes(32));
        $_SESSION['csrf_token'] = $token;
        $_SESSION['csrf_token_time'] = time();
        
        return $token;
    }
}

/**
 * Validate CSRF Token
 */
if (!function_exists('validateCSRFToken')) {
    function validateCSRFToken(?string $token = null): bool
    {
        // Bypass CSRF validation if request has a valid Authorization Bearer token (API/stateless mode)
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
        if ($authHeader && preg_match('/Bearer\s(\S+)/', $authHeader)) {
            return true;
        }

        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        $sessionToken = $_SESSION['csrf_token'] ?? null;
        $tokenTime = $_SESSION['csrf_token_time'] ?? 0;
        
        // Token expires after 1 hour
        if (time() - $tokenTime > 3600) {
            unset($_SESSION['csrf_token']);
            unset($_SESSION['csrf_token_time']);
            return false;
        }
        
        if (!$token || !$sessionToken) {
            return false;
        }
        
        return hash_equals($sessionToken, $token);
    }
}

/**
 * Get CSRF Token from Request
 */
if (!function_exists('getCSRFTokenFromRequest')) {
    function getCSRFTokenFromRequest(): ?string
    {
        // Check header first
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $token = $headers['X-CSRF-Token'] ?? $headers['x-csrf-token'] ?? null;
        
        if ($token) {
            return $token;
        }
        
        // Check POST body
        $data = json_decode(file_get_contents('php://input'), true);
        return $data['csrf_token'] ?? $_POST['csrf_token'] ?? null;
    }
}

/**
 * Debug Mode Status
 * Uses the cached merged settings to avoid a raw DB query on every request.
 */
if (!function_exists('isDebugEnabled')) {
    function isDebugEnabled(): bool
    {
        // Static cache: once resolved per PHP process, never re-query.
        static $cached = null;
        if ($cached !== null) {
            return $cached;
        }

        // 1. Prefer the already-cached merged settings (avoids a dedicated DB query)
        if (function_exists('eh_merged_super_settings')) {
            try {
                $settings = eh_merged_super_settings();
                if (isset($settings['debugMode'])) {
                    $cached = filter_var($settings['debugMode'], FILTER_VALIDATE_BOOLEAN);
                    return $cached;
                }
            } catch (Exception $e) {
                // Fall through to direct DB lookup
            }
        }

        // 2. Direct DB fallback (only if brand_settings.php not loaded yet)
        global $pdo;
        if (isset($pdo) && $pdo instanceof PDO) {
            try {
                $stmt = $pdo->prepare("SELECT setting_value FROM site_settings WHERE setting_key = 'debugMode' LIMIT 1");
                $stmt->execute();
                $val = $stmt->fetchColumn();
                if ($val !== false) {
                    $cached = filter_var($val, FILTER_VALIDATE_BOOLEAN);
                    return $cached;
                }
            } catch (Exception $e) {
                // DB query failed, fall through to JSON
            }
        }

        // 3. JSON file fallback (last resort)
        $settingsFile = __DIR__ . '/data/super_settings.json';
        if (file_exists($settingsFile)) {
            $settings = json_decode(file_get_contents($settingsFile), true);
            if (isset($settings['debugMode'])) {
                $cached = filter_var($settings['debugMode'], FILTER_VALIDATE_BOOLEAN);
                return $cached;
            }
        }

        $cached = false;
        return $cached;
    }
}




/**
 * Calculate Regional Shipping Fee
 * Returns array with 'fee', 'city'
 */
if (!function_exists('calculateRegionalShipping')) {
    function calculateRegionalShipping(string $userRegion, float $subtotal, PDO $pdo)
    {
        $baseFee = 35.00; // Default: Regional/Upcountry
        
        // Define 'Local' as Greater Accra (Main Hub Location)
        $localRegions = ['Greater Accra', 'Accra'];
        if ($userRegion && in_array($userRegion, $localRegions)) {
            $baseFee = 15.00;
        }
        
        // Dynamic discount for large orders
        if ($subtotal >= 1500) {
            $baseFee = $baseFee * 0.5;
        }
        return [
            'fee' => (float)$baseFee,
            'city' => 'Accra'
        ];
    }
}
/**
 * Get Effective Price
 * Calculates the current price based on percentage discounts and expiry
 */
if (!function_exists('getEffectivePrice')) {
    function getEffectivePrice(array $product)
    {
        $basePrice = (float)($product['price'] ?? 0);
        $discountPercent = (int)($product['discount_percent'] ?? 0);
        $saleEndsAt = $product['sale_ends_at'] ?? null;

        if ($discountPercent > 0) {
            $isExpired = false;
            if ($saleEndsAt) {
                $expiryTime = strtotime($saleEndsAt);
                if ($expiryTime < time()) {
                    $isExpired = true;
                }
            }

            if (!$isExpired) {
                $discountAmount = $basePrice * ($discountPercent / 100);
                return max(0, $basePrice - $discountAmount);
            }
        }

        return $basePrice;
    }
}
/**
 * Update User Level based on spend
 */
if (!function_exists('updateUserLevel')) {
    function updateUserLevel(int $userId, PDO $pdo)
    {
        try {
            // 1. Calculate total spend from completed orders
            $stmt = $pdo->prepare("
                SELECT SUM(total_amount) 
                FROM orders 
                WHERE user_id = ? AND status IN ('delivered', 'completed')
            ");
            $stmt->execute([$userId]);
            $totalSpend = (float)$stmt->fetchColumn() ?: 0;

            // 2. Determine Level based on spend
            $config = $GLOBALS['config'] ?? require_once 'config.php';
            $eliteThreshold = $config['ELITE_THRESHOLD'] ?? 500;
            $vipThreshold = $config['VIP_THRESHOLD'] ?? 2000;

            $levelName = "Starter";
            $levelNum = 1;

            if ($totalSpend >= $vipThreshold) {
                $levelName = "VIP"; $levelNum = 3;
            } elseif ($totalSpend >= $eliteThreshold) {
                $levelName = "Elite"; $levelNum = 2;
            }

            // 3. Update user level in DB if it changed
            $stmt = $pdo->prepare("UPDATE users SET level = ?, level_name = ? WHERE id = ? AND (level != ? OR level_name != ? OR level_name IS NULL)");
            $stmt->execute([$levelNum, $levelName, $userId, $levelNum, $levelName]);
            
            return [
                'total_spend' => $totalSpend,
                'level_name' => $levelName,
                'level_num' => $levelNum
            ];
        } catch (Exception $e) {
            error_log("Update user level error: " . $e->getMessage());
            return null;
        }
    }
}
/**
 * Centrally scrub user object for safe API transmission.
 * Strips password hashes, secrets, and other sensitive metadata.
 */
if (!function_exists('scrubUser')) {
    function scrubUser(array $user)
    {
        if (!$user || !is_array($user)) return null;
        
        $sensitiveFields = [
            'password_hash', 
            'two_factor_secret', 
            'temp_otp', 
            'reset_token', 
            'profile_image_raw', // Large binary data
            'auth_provider_id'
        ];

        foreach ($sensitiveFields as $field) {
            unset($user[$field]);
        }

        // Cast numeric types for consistency
        if (isset($user['id'])) $user['id'] = (int)$user['id'];
        if (isset($user['level'])) $user['level'] = (int)$user['level'];
        if (isset($user['loyalty_points'])) $user['loyalty_points'] = (int)$user['loyalty_points'];
        if (isset($user['login_attempts'])) $user['login_attempts'] = (int)$user['login_attempts'];

        return $user;
    }
}

/**
 * Generate Refresh Token
 * Creates a cryptographically secure random refresh token (7 days expiry)
 */
if (!function_exists('generateRefreshToken')) {
    function generateRefreshToken()
    {
        return bin2hex(random_bytes(32));
    }
}

/**
 * Hash Refresh Token
 * Hashes the refresh token before storing in database
 */
if (!function_exists('hashRefreshToken')) {
    function hashRefreshToken(string $token)
    {
        return hash('sha256', $token);
    }
}

/**
 * Store Refresh Token in Database
 * Stores the hashed refresh token with user and device info
 */
if (!function_exists('storeRefreshToken')) {
    function storeRefreshToken(PDO $pdo, int $userId, string $token, string $deviceFingerprint = null, string $ipAddress = null, string $userAgent = null)
    {
        $tokenHash = hashRefreshToken($token);
        $expiresAt = date('Y-m-d H:i:s', time() + (60 * 60 * 24 * 7)); // 7 days
        
        // Revoke old tokens for same device (token rotation)
        if ($deviceFingerprint) {
            $stmt = $pdo->prepare("UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = NOW() WHERE user_id = ? AND device_fingerprint = ? AND is_revoked = FALSE");
            $stmt->execute([$userId, $deviceFingerprint]);
        }
        
        $stmt = $pdo->prepare("
            INSERT INTO refresh_tokens (user_id, token_hash, device_fingerprint, ip_address, user_agent, expires_at, last_used_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        ");
        return $stmt->execute([$userId, $tokenHash, $deviceFingerprint, $ipAddress, $userAgent, $expiresAt]);
    }
}

/**
 * Verify Refresh Token
 * Verifies the refresh token and returns user_id if valid
 */
if (!function_exists('verifyRefreshToken')) {
    function verifyRefreshToken(PDO $pdo, string $token)
    {
        $tokenHash = hashRefreshToken($token);
        
        $stmt = $pdo->prepare("
            SELECT rt.id, rt.user_id, rt.expires_at, rt.is_revoked, u.status
            FROM refresh_tokens rt
            JOIN users u ON rt.user_id = u.id
            WHERE rt.token_hash = ? AND rt.is_revoked = FALSE
        ");
        $stmt->execute([$tokenHash]);
        $record = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$record) {
            return null;
        }
        
        // Check if expired
        if (strtotime($record['expires_at']) < time()) {
            // Mark as revoked
            $stmt = $pdo->prepare("UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = NOW() WHERE id = ?");
            $stmt->execute([$record['id']]);
            return null;
        }
        
        // Check if user account is active
        if ($record['status'] === 'Suspended' || $record['status'] === 'Deleted') {
            return null;
        }
        
        // Update last_used_at
        $stmt = $pdo->prepare("UPDATE refresh_tokens SET last_used_at = NOW() WHERE id = ?");
        $stmt->execute([$record['id']]);
        
        return (int)$record['user_id'];
    }
}

/**
 * Revoke Refresh Token
 * Revokes a specific refresh token
 */
if (!function_exists('revokeRefreshToken')) {
    function revokeRefreshToken(PDO $pdo, string $token)
    {
        $tokenHash = hashRefreshToken($token);
        $stmt = $pdo->prepare("UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = NOW() WHERE token_hash = ?");
        return $stmt->execute([$tokenHash]);
    }
}

/**
 * Revoke All User Refresh Tokens
 * Revokes all refresh tokens for a user (e.g., on password change)
 */
if (!function_exists('revokeAllUserRefreshTokens')) {
    function revokeAllUserRefreshTokens(PDO $pdo, int $userId)
    {
        $stmt = $pdo->prepare("UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = NOW() WHERE user_id = ? AND is_revoked = FALSE");
        return $stmt->execute([$userId]);
    }
}

/**
 * Generate Short-lived Access Token (15 minutes)
 * Used for API requests, stored in memory only
 */
if (!function_exists('generateAccessToken')) {
    function generateAccessToken(int $userId, string $role = 'customer')
    {
        $config = $GLOBALS['config'] ?? require_once 'config.php';
        $secret = $config['JWT_SECRET'];
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        
        $payload = json_encode([
            'user_id' => $userId,
            'role' => $role,
            'exp' => time() + (60 * 15), // 15 minutes
            'iat' => time(),
            'type' => 'access'
        ]);
        $b64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
        $b64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
        $sig = hash_hmac('sha256', "$b64Header.$b64Payload", $secret, true);
        $b64Sig = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($sig));
        return "$b64Header.$b64Payload.$b64Sig";
    }
}
