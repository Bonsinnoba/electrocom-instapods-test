require_once 'cors_middleware.php';
require_once 'security.php';
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$headers = function_exists('getallheaders') ? getallheaders() : [];
$appId = $headers['X-App-ID'] ?? $headers['x-app-id'] ?? 'storefront';
$cookieName = ($appId === 'admin') ? 'ehub_admin_refresh_token' : 'ehub_store_refresh_token';

// Get the refresh token from cookie — app-specific first, legacy shared name as fallback
$refreshToken = $_COOKIE[$cookieName] ?? $_COOKIE['ehub_refresh_token'] ?? null;

// Revoke refresh token from database
if ($refreshToken) {
    try {
        revokeRefreshToken($pdo, $refreshToken);
    } catch (Exception $e) {
        error_log("Refresh token revocation error: " . $e->getMessage());
        // Continue with logout even if revocation fails
    }
}

// Clear the refresh token cookies — SameSite must match the one used when set.
// Clear both the app-specific cookie and the legacy shared one, in case this
// session hasn't migrated off the old shared cookie yet.
$isProd = ($config['APP_ENV'] ?? 'production') === 'production';
// Use null for domain to allow browser default behavior (fixes cross-port cookie issues in dev)
$cookieDomain = $isProd ? '' : null;
$cookieOptions = [
    'expires'  => time() - 3600,
    'path'     => '/',
    'domain'   => $cookieDomain,
    'secure'   => $isProd ? true : (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on'),
    'httponly' => true,
    'samesite' => $isProd ? 'Strict' : 'Lax'
];
setcookie($cookieName, '', $cookieOptions);
setcookie('ehub_refresh_token', '', $cookieOptions);

// Clear the HttpOnly session cookie (legacy)
clearSession();

header('Content-Type: application/json');
echo json_encode(['success' => true, 'message' => 'Logged out successfully']);
exit;
