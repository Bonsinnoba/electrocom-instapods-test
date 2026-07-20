
<?php
// backend/verify_id.php
require 'cors_middleware.php';
require 'db.php';
require 'security.php';

header('Content-Type: application/json');

// authenticate and require admin or super
$userId = authenticate();
$role = getUserRole($userId, $pdo);
if (!in_array($role, ['super', 'store_manager'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden: admin access required.']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // return pending verifications
    try {
        $stmt = $pdo->query("SELECT id, name, email, phone, id_number, id_photo, id_verified, id_verified_at, id_verification_reason FROM users WHERE id_number IS NOT NULL AND id_verified = 0 ORDER BY created_at DESC");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        // decrypt photos before sending
        foreach ($rows as &$r) {
            if (!empty($r['id_photo'])) {
                $r['id_photo'] = decryptData($r['id_photo']);
            }
        }
        unset($r);
        echo json_encode(['success' => true, 'data' => $rows]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error fetching verifications', 'error' => $e->getMessage()]);
    }
    exit;
} elseif ($method === 'POST') {
    $content = trim(file_get_contents("php://input"));
    $decoded = json_decode($content, true);
    $action = $decoded['action'] ?? '';
    $targetId = $decoded['user_id'] ?? null;
    $reason = sanitizeInput($decoded['reason'] ?? '');

    if (!$targetId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'user_id is required']);
        exit;
    }

    try {
        if ($action === 'approve') {
            $stmt = $pdo->prepare("UPDATE users SET id_verified = 1, id_verified_at = NOW(), id_verification_reason = ?, id_verifier_id = ? WHERE id = ?");
            $stmt->execute([$reason, $userId, $targetId]);
            echo json_encode(['success' => true]);
        } elseif ($action === 'reject') {
            // optionally clear the fields or leave them but mark reason
            $stmt = $pdo->prepare("UPDATE users SET id_verified = 0, id_verification_reason = ?, id_verifier_id = ? WHERE id = ?");
            $stmt->execute([$reason, $userId, $targetId]);
            echo json_encode(['success' => true]);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error', 'error' => $e->getMessage()]);
    }
    exit;
}

// fallback
http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
