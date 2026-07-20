<?php
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

try {
    $userId = authenticate($pdo);

    if (!$userId) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized']);
        exit;
    }

    // Validate CSRF token
    $csrfToken = getCSRFTokenFromRequest();
    if (!validateCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired CSRF token. Please refresh the page and try again.']);
        exit;
    }

    // Require password confirmation for critical action
    $data = json_decode(file_get_contents('php://input'), true);
    $password = validateString($data['password'] ?? '');
    
    if (empty($password)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Password confirmation is required to delete your account.']);
        exit;
    }
    
    if (!verifyReauthentication($pdo, $userId, $password)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid password. Account deletion requires password confirmation.']);
        exit;
    }

    $pdo->beginTransaction();

    // Delete related data first (optional, depending on schema CASCADE rules)
    // For now, we'll just delete the user, assuming CASCADE is in place or not strictly required for this build

    $stmt = $pdo->prepare("UPDATE users SET deleted_at = NOW(), status = 'Deleted' WHERE id = ?");
    $stmt->execute([$userId]);

    $pdo->commit();

    // Proactively clear the session cookie on deletion
    clearSession();

    echo json_encode(['success' => true, 'message' => 'Account deleted successfully.']);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to delete account: ' . $e->getMessage()]);
}
