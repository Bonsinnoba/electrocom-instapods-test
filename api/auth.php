
<?php
// backend/products.php
require 'cors_middleware.php';
require 'db.php';
require 'security.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';

if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'check_session') {
    http_response_code(405);
    sendResponse(false, 'Session check is now handled via JWT/Token middleware.');
}

if ($method === 'POST') {
    $content = trim(file_get_contents("php://input"));
    $decoded = json_decode($content, true);

    if (!is_array($decoded)) {
        sendResponse(false, 'Invalid JSON payload', null, 400);
    }

    $action = $decoded['action'] ?? '';

    if ($action === 'register') {
        $name = sanitizeInput($decoded['name'] ?? '');
        $email = sanitizeInput($decoded['email'] ?? '');
        $password = $decoded['password'] ?? '';

        if (!$name || !$email || !$password) {
            sendResponse(false, 'Missing required fields', null, 400);
        }

        // Check if email exists
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            sendResponse(false, 'Email already registered', null, 409);
        }

        // Create new user
        $hash = hashPassword($password);
        $stmt = $pdo->prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)");

        try {
            $stmt->execute([$name, $email, $hash]);
            $userId = $pdo->lastInsertId();

            // Fetch newly created user
            $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            sendResponse(true, 'Registration successful', ['user' => scrubUser($user)]);
        } catch (PDOException $e) {
            sendResponse(false, 'Registration failed: ' . $e->getMessage(), null, 500);
        }
    } elseif ($action === 'login') {
        // Redundant with login.php, but keeping for compatibility if used
        $email = sanitizeInput($decoded['email'] ?? '');
        $password = $decoded['password'] ?? '';

        if (!$email || !$password) {
            sendResponse(false, 'Missing email or password', null, 400);
        }

        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user && verifyPassword($password, $user['password_hash'])) {
            sendResponse(true, 'Login successful', ['user' => scrubUser($user)]);
        } else {
            sendResponse(false, 'Invalid credentials', null, 401);
        }
    } else {
        sendResponse(false, 'Invalid action', null, 400);
    }
}
