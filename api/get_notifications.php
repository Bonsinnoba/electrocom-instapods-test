<?php
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$headers = function_exists('getallheaders') ? getallheaders() : [];
$appId = $headers['X-App-ID'] ?? $headers['x-app-id'] ?? null;

// Authenticate user
$userId = authenticate($pdo);
$role = getUserRole($userId, $pdo);

if ($method === 'GET') {
    try {
        if (isset($_GET['admin']) && $_GET['admin'] === 'true') {
            // Admin view: check if authorized
            if (!in_array($role, RBAC_ADMIN_GROUP) && $role !== 'super') {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Forbidden']);
                exit;
            }

            // Admin platform scope:
            // - Always include notifications explicitly addressed to this admin user.
            // - Also include high-signal operations/security events across staff accounts.
            $stmt = $pdo->prepare("
                SELECT n.*, u.name as user_name 
                FROM notifications n 
                LEFT JOIN users u ON n.user_id = u.id 
                WHERE (
                    n.user_id = ?
                    OR (
                        n.type IN ('security', 'system', 'order')
                        AND u.role IN ('super', 'marketing', 'accountant', 'store_manager')
                    )
                )
                ORDER BY n.created_at DESC LIMIT 50
            ");
            $stmt->execute([$userId]);
        } else {
            // Storefront scope: customers should not receive admin/system operational alerts.
            if ($appId === 'storefront' || $appId === 'customer') {
                $stmt = $pdo->prepare("
                    SELECT * FROM notifications
                    WHERE user_id = ?
                      AND type IN ('order', 'promo', 'info')
                    ORDER BY created_at DESC LIMIT 50
                ");
                $stmt->execute([$userId]);
            } else {
                // Default user scope
                $stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50");
                $stmt->execute([$userId]);
            }
        }

        $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'data' => $notifications]);
    } catch (PDOException $e) {
        sendDatabaseError($e, 'Unable to retrieve notifications.');
    }
} elseif ($method === 'POST' && $action === 'mark_read') {
    $data = json_decode(file_get_contents('php://input'), true);
    $notificationId = $data['id'] ?? null;

    if (!$notificationId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Notification ID required']);
        exit;
    }

    try {
        // Ensure user owns the notification or is admin
        $stmt = $pdo->prepare("SELECT user_id FROM notifications WHERE id = ?");
        $stmt->execute([$notificationId]);
        $notif = $stmt->fetch();

        if (!$notif) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Notification not found']);
            exit;
        }

        if ($notif['user_id'] != $userId && !in_array($role, RBAC_ADMIN_GROUP) && $role !== 'super') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Forbidden']);
            exit;
        }

        $update = $pdo->prepare("UPDATE notifications SET is_read = TRUE WHERE id = ?");
        $update->execute([$notificationId]);

        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        sendDatabaseError($e, 'Unable to mark notification as read.');
    }
} elseif ($method === 'POST' && $action === 'delete') {
    $data = json_decode(file_get_contents('php://input'), true);
    $notificationId = $data['id'] ?? null;

    if (!$notificationId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Notification ID required']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("SELECT user_id FROM notifications WHERE id = ?");
        $stmt->execute([$notificationId]);
        $notif = $stmt->fetch();

        if (!$notif) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Notification not found']);
            exit;
        }

        if ($notif['user_id'] != $userId && !in_array($role, RBAC_ADMIN_GROUP) && $role !== 'super') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Forbidden']);
            exit;
        }

        $delete = $pdo->prepare("DELETE FROM notifications WHERE id = ?");
        $delete->execute([$notificationId]);

        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        sendDatabaseError($e, 'Unable to delete notification.');
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
