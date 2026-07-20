require_once 'security.php';
require_once 'db.php';

// Simple CORS headers for development
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-App-ID, X-Session-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Get the current token before clearing session
$token = null;
$headers = function_exists('getallheaders') ? getallheaders() : [];
$appId = $headers['X-App-ID'] ?? $headers['x-app-id'] ?? null;

// Try to get token from headers
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
if ($authHeader && preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
    $token = $matches[1];
}

if (!$token) {
    $token = $headers['X-Session-Token'] ?? $headers['x-session-token'] ?? null;
}

// Try to get token from cookies
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

// If we have a token, blacklist it
if ($token) {
    try {
        $parts = explode('.', $token);
        if (count($parts) === 3) {
            // Get token signature (the third part)
            $tokenSignature = $parts[2];
            
            // Decode payload to get user_id and expiration
            $payload = json_decode(base64_decode($parts[1]), true);
            if ($payload && isset($payload['user_id']) && isset($payload['exp'])) {
                $userId = $payload['user_id'];
                $expiresAt = date('Y-m-d H:i:s', $payload['exp']);
                
                // Insert into revoked_tokens table
                $stmt = $pdo->prepare("INSERT INTO revoked_tokens (token_signature, user_id, expires_at) VALUES (?, ?, ?)");
                $stmt->execute([$tokenSignature, $userId, $expiresAt]);
            }
        }
    } catch (Exception $e) {
        error_log("Token revocation error: " . $e->getMessage());
        // Continue with logout even if revocation fails
    }
}

// Clear the HttpOnly session cookie
clearSession();

header('Content-Type: application/json');
echo json_encode(['success' => true, 'message' => 'Logged out successfully']);
exit;
