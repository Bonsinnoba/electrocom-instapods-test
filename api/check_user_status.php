<?php
require_once 'cors_middleware.php';
require_once 'db.php';
require_once 'security.php';

// Specific role check removed to allow all users to check their own status
// authenticate() below handles basic token validation


header('Content-Type: application/json');

try {
    // This will handle token verification and exit if unauthorized
    $userId = authenticate($pdo);

    $stmt = $pdo->prepare("SELECT id, name, email, phone, address, level, level_name, loyalty_points, avatar_text, profile_image, status, role, email_notif, push_notif, sms_tracking FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'User not found.']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'user' => [
                'id' => (int)$user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'phone' => $user['phone'] ?? '',
                'address' => $user['address'] ?? '',
                'level' => $user['level'] ?? 1,
                'levelName' => $user['level_name'] ?? 'Starter',
                'loyalty_points' => (int)($user['loyalty_points'] ?? 0),
                'avatar' => $user['avatar_text'] ?? '',
                'profileImage' => $user['profile_image'] ?? null,
                'status' => $user['status'],
                'role' => $user['role'],
                'email_notif' => (bool)($user['email_notif'] ?? true),
                'push_notif' => (bool)($user['push_notif'] ?? true),
                'sms_tracking' => (bool)($user['sms_tracking'] ?? true)
            ]
        ]
    ]);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Status check error: ' . $e->getMessage()]);
}
