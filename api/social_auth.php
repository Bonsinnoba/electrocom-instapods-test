<?php
// backend/social_auth.php
require __DIR__ . '/cors_middleware.php';
require __DIR__ . '/db.php';
require __DIR__ . '/security.php';
require_once __DIR__ . '/brand_settings.php';
require __DIR__ . '/vendor/autoload.php';

use League\OAuth2\Client\Provider\GenericProvider;

header('Content-Type: application/json');

if (!isset($config) || !is_array($config)) {
    $config = require_once __DIR__ . '/config.php';
}
$provider = $_GET['provider'] ?? '';
$code = $_GET['code'] ?? null;
$state = $_GET['state'] ?? null;

if (!$provider) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Provider parameter is required.']);
    exit;
}

// Initialize OAuth providers using GenericProvider (league/oauth2-client only ships GenericProvider)
$providers = [
    'google' => new GenericProvider([
        'clientId' => $config['GOOGLE_CLIENT_ID'] ?? '',
        'clientSecret' => $config['GOOGLE_CLIENT_SECRET'] ?? '',
        'redirectUri' => $config['GOOGLE_REDIRECT'] ?? '',
        'urlAuthorize' => 'https://accounts.google.com/o/oauth2/v2/auth',
        'urlAccessToken' => 'https://oauth2.googleapis.com/token',
        'urlResourceOwnerDetails' => 'https://www.googleapis.com/oauth2/v2/userinfo',
        'scopes' => ['openid', 'email', 'profile'],
        'scopeSeparator' => ' ',
    ]),
    'github' => new GenericProvider([
        'clientId' => $config['GITHUB_CLIENT_ID'] ?? '',
        'clientSecret' => $config['GITHUB_CLIENT_SECRET'] ?? '',
        'redirectUri' => $config['GITHUB_REDIRECT'] ?? '',
        'urlAuthorize' => 'https://github.com/login/oauth/authorize',
        'urlAccessToken' => 'https://github.com/login/oauth/access_token',
        'urlResourceOwnerDetails' => 'https://api.github.com/user',
    ]),
];

if (!isset($providers[$provider])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Unsupported provider']);
    exit;
}

// Require credentials so we don't send user to provider with missing client_id (e.g. Google "Missing required parameter: client_id")
$requiredKeys = [
    'google'   => ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT'],
    'github'   => ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_REDIRECT'],
];
foreach ($requiredKeys[$provider] as $key) {
    if (empty($config[$key]) || !trim((string) $config[$key])) {
        $frontend = $config['FRONTEND_URL'] ?? '';
        $internalMsg = 'Sign-in with ' . ucfirst($provider) . ' is not configured. Please set ' . $key . ' (and related keys) in the server .env.php and in the ' . ucfirst($provider) . ' developer console.';
        error_log("Social Auth Config Error: " . $internalMsg);

        $msg = 'Sign-in with ' . ucfirst($provider) . ' is currently unavailable. Please try another sign-in method or contact support.';

        if ($frontend) {
            header('Location: ' . rtrim($frontend, '/') . '/?social_error=' . urlencode($msg));
            exit;
        }
        http_response_code(503);
        echo json_encode(['success' => false, 'message' => $msg]);
        exit;
    }
}

$oauthProvider = $providers[$provider];

if (!$code) {
    // Build the base authorization URL from the provider
    $authorizationUrl = $oauthProvider->getAuthorizationUrl();
    $_SESSION['oauth_state'] = $oauthProvider->getState();

    // Force account selection screen — prevent silent re-auth on every provider.
    // GenericProvider sends 'approval_prompt' by default; Google rejects it
    // alongside 'prompt', so we strip it out and inject only 'prompt'.
    $parsed = parse_url($authorizationUrl);
    parse_str($parsed['query'] ?? '', $queryParams);

    if ($provider === 'google') {
        // Remove GenericProvider's 'approval_prompt' and use 'prompt' instead
        unset($queryParams['approval_prompt']);
        $queryParams['prompt'] = 'select_account';
    } elseif ($provider === 'github') {
        // GitHub does not support 'prompt' parameter
        // Add 'login' parameter to force re-authentication and consent
        // This ensures GitHub asks for consent even if previously authorized
        $queryParams['login'] = ''; // Empty value forces login prompt
    }

    $authorizationUrl = $parsed['scheme'] . '://' . $parsed['host'] . $parsed['path'] . '?' . http_build_query($queryParams);

    header('Location: ' . $authorizationUrl);
    exit;
}

try {
    // exchange code for access token
    $accessToken = $oauthProvider->getAccessToken('authorization_code', [
        'code' => $code
    ]);

    // fetch user profile
    $resourceOwner = $oauthProvider->getResourceOwner($accessToken);
    $userInfo = $resourceOwner->toArray();

    // extract email and name (provider-specific)
    $email = null;
    $name = null;

    switch ($provider) {
        case 'google':
            $email = $userInfo['email'] ?? null;
            $name = $userInfo['name'] ?? null;
            $picture = $userInfo['picture'] ?? null;
            break;
        case 'github':
            $email = $userInfo['email'] ?? null;
            $name = $userInfo['name'] ?? $userInfo['login'] ?? null;
            $picture = $userInfo['avatar_url'] ?? null;
            // GitHub users can set their email to private; fetch from /user/emails API as fallback
            if (!$email) {
                $emailsResponse = @file_get_contents(
                    'https://api.github.com/user/emails',
                    false,
                    stream_context_create(['http' => [
                        'header' => [
                            'Authorization: Bearer ' . $accessToken->getToken(),
                            'User-Agent: ' . preg_replace('/[^a-zA-Z0-9.-]/', '-', eh_brand_site_name()) . '-App',
                            'Accept: application/vnd.github+json'
                        ]
                    ]])
                );
                if ($emailsResponse) {
                    $emails = json_decode($emailsResponse, true);
                    foreach ($emails as $emailEntry) {
                        if ($emailEntry['primary'] && $emailEntry['verified']) {
                            $email = $emailEntry['email'];
                            break;
                        }
                    }
                }
            }
            break;
    }

    if (!$email) {
        throw new Exception('No email returned by provider. If using GitHub, please make your email public in GitHub settings.');
    }

    // --- Self-healing Schema ---
    if ($config['DB_AUTO_REPAIR'] ?? false) {
        try {
            $cols = $pdo->query("DESCRIBE users")->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array('auth_provider', $cols)) {
                $pdo->exec("ALTER TABLE users ADD COLUMN auth_provider VARCHAR(50) DEFAULT 'local'");
            }
            if (!in_array('auth_provider_id', $cols)) {
                $pdo->exec("ALTER TABLE users ADD COLUMN auth_provider_id VARCHAR(255) DEFAULT NULL");
            }
        } catch (Exception $e) {
            error_log("Schema auto-repair failed in social_auth: " . $e->getMessage());
        }
    }

    // look up or create local user
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        $providerId = $userInfo['id'] ?? $userInfo['sub'] ?? null;
        $randomPassword = password_hash(bin2hex(random_bytes(16)), PASSWORD_BCRYPT);
        
        $insertStmt = $pdo->prepare("INSERT INTO users (name, email, password_hash, is_verified, auth_provider, auth_provider_id, avatar_text, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?, NOW(), NOW())");
        $insertStmt->execute([$name ?: 'New User', $email, $randomPassword, $provider, $providerId, generateInitials($name ?: 'New User')]);
        
        $newUserId = $pdo->lastInsertId();
        
        // Fetch the newly created user
        $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$newUserId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Log the auto-registration
        logger('ok', 'AUTH_SOCIAL', "User automatically registered via $provider: {$email}");
    } else {
        // Option: Link the provider ID if it was a local account
        if (empty($user['auth_provider']) || $user['auth_provider'] === 'local') {
             $providerId = $userInfo['id'] ?? $userInfo['sub'] ?? null;
             $updateStmt = $pdo->prepare("UPDATE users SET auth_provider = ?, auth_provider_id = ? WHERE id = ?");
             $updateStmt->execute([$provider, $providerId, $user['id']]);
        }
        logger('info', 'AUTH_SOCIAL', "User logged in via $provider: {$email}");
    }

    // issue token
    $token = generateToken($user['id'], $user['role'] ?? 'customer');

    // Store device fingerprint for admin/staff users
    if (in_array($user['role'] ?? 'customer', ['admin', 'staff']) && function_exists('generateDeviceFingerprint')) {
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

    require_once __DIR__ . '/auth_login_log.php';
    logSuccessfulAuthLogin($pdo, (int) $user['id'], $provider);

    // Set HttpOnly Cookie for session persistence (matches login.php)
    $isProd = ($config['APP_ENV'] ?? 'production') === 'production';
    setcookie('ehub_session', $token, [
        'expires' => time() + (60 * 60 * 24), // 24 hours
        'path' => '/',
        'domain' => '', // Current domain
        'secure' => $isProd ? true : (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on'),
        'httponly' => true,
        'samesite' => $isProd ? 'Strict' : 'Lax'
    ]);
    $frontend = $config['FRONTEND_URL'] ?? '';
    if ($frontend) {
        $minimalUser = [
            'id'                 => (int)$user['id'],
            'name'               => $user['name'],
            'email'              => $user['email'],
            'phone'              => $user['phone'] ?? '',
            'address'            => $user['address'] ?? '',
            'level'              => (int)($user['level'] ?? 1),
            'level_name'         => $user['level_name'] ?? 'Starter',
            'avatar_text'        => ($user['avatar_text'] && $user['avatar_text'] !== 'U') ? $user['avatar_text'] : generateInitials($user['name'] ?? 'U'),
            'profile_image'      => $picture ?? $user['profile_image'] ?? null,
            'role'               => $user['role'] ?? 'customer',
            'email_notif'        => (bool)($user['email_notif'] ?? true),
            'push_notif'         => (bool)($user['push_notif'] ?? true),
            'sms_tracking'       => (bool)($user['sms_tracking'] ?? true),
            'theme'              => $user['theme'] ?? 'blue',
        ];
        
        // Store opaque code in a shared file (not $_SESSION) so the exchange
        // endpoint can read it cross-origin without relying on cookie-based sessions.
        $opaqueCode = bin2hex(random_bytes(16));
        $codeFile = __DIR__ . '/data/social_auth_codes.json';
        if (!is_dir(__DIR__ . '/data')) {
            mkdir(__DIR__ . '/data', 0755, true);
        }
        $codes = [];
        if (file_exists($codeFile)) {
            $codes = json_decode(file_get_contents($codeFile), true) ?: [];
        }
        // Purge any expired codes while we're here
        $now = time();
        $codes = array_filter($codes, fn($c) => isset($c['expires_at']) && $c['expires_at'] > $now);
        $codes[$opaqueCode] = [
            'token'      => $token,
            'user'       => $minimalUser,
            'expires_at' => $now + 600 // 10 minutes (increased from 5)
        ];
        $writeResult = @file_put_contents($codeFile, json_encode($codes, JSON_PRETTY_PRINT), LOCK_EX);
        if ($writeResult === false) {
            error_log("Failed to write to social_auth_codes.json in social_auth.php");
        }
        
        // Redirect with opaque code instead of actual token
        $location = rtrim($frontend, '/') . '/?social_auth=' . urlencode($opaqueCode);
        
        // Use window.location.replace to prevent history bloat (Backward/Forward situtation fix)
        header('Content-Type: text/html; charset=UTF-8');
        echo "<html><head><title>Redirecting...</title></head><body>
              <script>window.location.replace('" . addslashes($location) . "');</script>
              </body></html>";
        exit;
    }

    echo json_encode(['success' => true, 'data' => [
        'token' => $token,
        'user' => [
            'id' => (int)$user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'phone' => $user['phone'] ?? '',
            'address' => $user['address'] ?? '',
            'level' => $user['level'] ?? 1,
            'levelName' => $user['level_name'] ?? 'Starter',
            'avatar' => $user['avatar_text'] ?? '',
            'profileImage' => (strlen($user['profile_image'] ?? '') > 50000) ? null : ($user['profile_image'] ?? null),
            'role' => $user['role'],
            'email_notif' => (bool)($user['email_notif'] ?? true),
            'push_notif' => (bool)($user['push_notif'] ?? true),
            'sms_tracking' => (bool)($user['sms_tracking'] ?? true),
            'two_factor_enabled' => (bool)($user['two_factor_enabled'] ?? false)
        ]
    ]]);
} catch (Exception $e) {
    // on error, try to redirect back to front-end with message
    $err = $e->getMessage();
    error_log("SOCIAL AUTH FATAL EXCEPTION: " . get_class($e) . " - " . $e->getMessage() . (($e instanceof \League\OAuth2\Client\Provider\Exception\IdentityProviderException) ? " BODY: " . print_r($e->getResponseBody(), true) : "") . "\n", 3, __DIR__ . "/social_debug.log");
    $frontend = $config['FRONTEND_URL'] ?? '';
    if ($frontend) {
        $location = rtrim($frontend, '/') . '/?social_error=' . urlencode($err);
        header('Location: ' . $location);
        exit;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $err]);
}
