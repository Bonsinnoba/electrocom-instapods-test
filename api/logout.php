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

// Get the refresh token from cookie
$refreshToken = $_COOKIE['ehub_refresh_token'] ?? null;

// Revoke refresh token from database
if ($refreshToken) {
    try {
        revokeRefreshToken($pdo, $refreshToken);
    } catch (Exception $e) {
        error_log("Refresh token revocation error: " . $e->getMessage());
        // Continue with logout even if revocation fails
    }
}

// Clear the refresh token cookie — SameSite must match the one used when it was set
$isProd = ($config['APP_ENV'] ?? 'production') === 'production';
// Use null for domain to allow browser default behavior (fixes cross-port cookie issues in dev)
$cookieDomain = $isProd ? '' : null;
setcookie('ehub_refresh_token', '', [
    'expires'  => time() - 3600,
    'path'     => '/',
    'domain'   => $cookieDomain,
    'secure'   => $isProd ? true : (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on'),
    'httponly' => true,
    'samesite' => $isProd ? 'Strict' : 'Lax'
]);

// Clear the HttpOnly session cookie (legacy)
clearSession();

header('Content-Type: application/json');
echo json_encode(['success' => true, 'message' => 'Logged out successfully']);
exit;
