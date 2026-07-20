<?php
// backend/forgot_password.php
require_once 'db.php';
require_once 'security.php';
require_once 'notifications.php';
require_once __DIR__ . '/email/EmailEngine.php';
require_once __DIR__ . '/brand_settings.php';

// Rate limit: 4 password reset attempts per IP per hour
checkRateLimit($pdo, 4, 3600);

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

// --- Self-healing Schema: password_resets table ---
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS password_resets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (email),
        INDEX (token)
    )");
} catch (Exception $e) {
    error_log("password_resets schema self-healing failed: " . $e->getMessage());
}

$rawData = file_get_contents('php://input');
$data = json_decode($rawData, true);

$email = sanitizeInput($data['email'] ?? '');
$method = sanitizeInput($data['method'] ?? 'email'); // 'email' or 'sms'

if (empty($email)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email is required.']);
    exit;
}

try {
    // Check if user exists
    $stmt = $pdo->prepare("SELECT id, name, phone FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user) {
        // Generate a 6-digit OTP code
        $token = str_pad(rand(100000, 999999), 6, '0', STR_PAD_LEFT);
        $expiresAt = date('Y-m-d H:i:s', time() + 600); // 10 minutes expiry

        // Store token (delete old ones first for this email)
        $stmt = $pdo->prepare("DELETE FROM password_resets WHERE email = ?");
        $stmt->execute([$email]);

        $stmt = $pdo->prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)");
        $stmt->execute([$email, $token, $expiresAt]);

        $notifier = new NotificationService();
        $emailEngine = new EmailEngine($pdo, $config);
        $bn = eh_brand_site_name();

        if ($method === 'sms' && !empty($user['phone'])) {
            // Send SMS
            $msg = "{$bn}: Your password reset code is {$token}. It expires in 10 minutes.";
            $notifier->queueNotification('sms', $user['phone'], $msg);
            logger('ok', 'AUTH_FORGOT_SMS', "Password reset code queued/sent via SMS to {$user['phone']}");
            $actualMethod = 'sms';
        } else {
            // Default to Email
            $queued = $emailEngine->queueTemplate($email, 'password_reset_otp', [
                'name' => $user['name'],
                'otp' => $token,
                'expires_minutes' => 10,
            ]);
            if (!$queued) {
                // Fallback to legacy notification queue for continuity.
                $subject = "Your {$bn} Password Reset Code";
                $msg = "Hello {$user['name']},\n\nWe received a request to reset your password. Your 6-digit reset code is:\n\n{$token}\n\nThis code will expire in 10 minutes. If you didn't request this, please safely ignore this email.";
                $notifier->queueNotification('email', $email, $msg, $subject);
            }
            logger('ok', 'AUTH_FORGOT_EMAIL', "Password reset code sent to {$email}");
            $actualMethod = 'email';
        }
    } else {
        // User not found, but we keep it generic. 
        // We'll use the requested method for the message to avoid enumeration.
        $actualMethod = $method;
    }

    // Always return success to prevent enumeration
    $targetName = ($actualMethod === 'sms') ? 'phone number' : 'email address';
    echo json_encode([
        'success' => true,
        'message' => "If an account exists, a password reset link has been sent to your registered {$targetName}."
    ]);
} catch (Exception $e) {
    logger('error', 'PASSWORD_FORGOT', "Forgot password failed for $email: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal Server Error during password reset request.']);
}
