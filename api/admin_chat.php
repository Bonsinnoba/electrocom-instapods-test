<?php

require_once 'cors_middleware.php';
require_once 'security.php';
require_once 'db.php';
require_once 'notifications.php';
require_once __DIR__ . '/brand_settings.php';

// Authenticate staff only (allow all admins, super admins, pickers, marketing, and POS cashiers)
try {
    $userId = requireRole(array_merge(RBAC_ALL_ADMINS, ['pos_cashier']), $pdo);
} catch (Exception $e) {
    sendResponse(false, 'Unauthorized: Staff access required.', null, 401);
}

// Fetch user data for chat context
$stmt = $pdo->prepare("SELECT id, name, role FROM users WHERE id = ?");
$stmt->execute([$userId]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    sendResponse(false, 'User record mismatch.', null, 401);
}

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'users') {
        // Fetch all staff members except the current user
        $stmt = $pdo->prepare("SELECT id, name, email, role, avatar_text, profile_image FROM users WHERE role IN ('super', 'admin', 'store_manager', 'marketing', 'accountant', 'picker', 'pos_cashier') AND id != ?");
        $stmt->execute([$user['id']]);
        $staff = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Calculate unread counts per user
        $unreadStmt = $pdo->prepare("SELECT sender_id, COUNT(*) as unread_count FROM admin_messages WHERE receiver_id = ? AND is_read = 0 GROUP BY sender_id");
        $unreadStmt->execute([$user['id']]);
        $unreadCounts = $unreadStmt->fetchAll(PDO::FETCH_KEY_PAIR);

        foreach ($staff as &$s) {
            $s['unread_count'] = $unreadCounts[$s['id']] ?? 0;
        }

        // Also get unread count for global channel (where receiver_id is NULL)
        // Wait, global channel messages aren't perfectly tracked per-user for "read" status easily without a pivot table. 
        // We can just omit unread counts for the global channel, or use a last-seen timestamp.
        
        echo json_encode(['success' => true, 'users' => $staff]);
        exit;
    }

    if ($action === 'history') {
        $with_user = isset($_GET['with_user']) && $_GET['with_user'] !== 'global' ? (int)$_GET['with_user'] : null;
        $limit = min(200, max(50, (int)($_GET['limit'] ?? 150)));

        if ($with_user === null) {
            // Global channel — paginated
            $stmt = $pdo->prepare("
                SELECT m.*, u.name as sender_name, u.avatar_text, u.profile_image, 
                       p.name as pinner_name, r.message as reply_to_message, ru.name as reply_to_name
                FROM admin_messages m 
                JOIN users u ON m.sender_id = u.id 
                LEFT JOIN users p ON m.pinned_by = p.id
                LEFT JOIN admin_messages r ON m.reply_to_id = r.id
                LEFT JOIN users ru ON r.sender_id = ru.id
                WHERE m.receiver_id IS NULL 
                ORDER BY m.created_at ASC
                LIMIT $limit
            ");
            $stmt->execute();
        } else {
            // DM — paginated
            $stmt = $pdo->prepare("
                SELECT m.*, u.name as sender_name, u.avatar_text, u.profile_image, 
                       p.name as pinner_name, r.message as reply_to_message, ru.name as reply_to_name
                FROM admin_messages m 
                JOIN users u ON m.sender_id = u.id 
                LEFT JOIN users p ON m.pinned_by = p.id
                LEFT JOIN admin_messages r ON m.reply_to_id = r.id
                LEFT JOIN users ru ON r.sender_id = ru.id
                WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?) 
                ORDER BY m.created_at ASC
                LIMIT $limit
            ");
            $stmt->execute([$user['id'], $with_user, $with_user, $user['id']]);
        }

        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'messages' => $messages]);
        exit;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    
    if ($action === 'send') {
        $receiver_id = isset($data['receiver_id']) && $data['receiver_id'] !== 'global' ? (int)$data['receiver_id'] : null;
        $message = trim($data['message'] ?? '');
        $is_pinned = !empty($data['is_pinned']) ? 1 : 0;
        $send_email = !empty($data['send_email']) ? 1 : 0;
        $send_sms = !empty($data['send_sms']) ? 1 : 0;
        $reply_to_id = isset($data['reply_to_id']) ? (int)$data['reply_to_id'] : null;

        if (empty($message)) {
            echo json_encode(['error' => 'Message is empty']);
            exit;
        }

        // Only admins/managers/super can pin
        if ($is_pinned && !in_array($user['role'], ['super', 'admin', 'store_manager'])) {
            $is_pinned = 0;
        }

        $pinned_by = $is_pinned ? $user['id'] : null;
        
        // Handle file attachment — validate real MIME type from decoded bytes
        $attachment_url = null;
        if (!empty($data['attachment_base64'])) {
            $base64Parts = explode(',', $data['attachment_base64']);
            if (count($base64Parts) === 2) {
                $decodedBytes = base64_decode($base64Parts[1], true);
                if ($decodedBytes !== false && strlen($decodedBytes) > 0) {
                    // Determine MIME from actual file bytes, NOT client-supplied header
                    $finfo = new finfo(FILEINFO_MIME_TYPE);
                    $realMime = $finfo->buffer($decodedBytes);

                    $allowedMimes = [
                        'image/jpeg' => 'jpg',
                        'image/png'  => 'png',
                        'image/gif'  => 'gif',
                        'image/webp' => 'webp',
                    ];

                    if (!isset($allowedMimes[$realMime])) {
                        echo json_encode(['error' => 'Only image attachments (JPEG, PNG, GIF, WebP) are allowed.']);
                        exit;
                    }

                    // Enforce max 5 MB
                    if (strlen($decodedBytes) > 5 * 1024 * 1024) {
                        echo json_encode(['error' => 'Attachment exceeds the 5 MB size limit.']);
                        exit;
                    }

                    $ext = $allowedMimes[$realMime];
                    $uploadDir = __DIR__ . '/uploads/chat/';
                    if (!is_dir($uploadDir)) {
                        mkdir($uploadDir, 0755, true);
                    }

                    $fileName = time() . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
                    file_put_contents($uploadDir . $fileName, $decodedBytes);
                    $attachment_url = 'api/uploads/chat/' . $fileName;
                }
            }
        }

        try {
            if (function_exists('logApp')) logApp('info', 'CHAT', "Attempting insert for user " . $user['id']);
            
            $stmt = $pdo->prepare("INSERT INTO admin_messages (sender_id, receiver_id, message, is_pinned, pinned_by, attachment_url, reply_to_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$user['id'], $receiver_id, $message, $is_pinned, $pinned_by, $attachment_url, $reply_to_id]);
            
            $message_id = $pdo->lastInsertId();
            if (function_exists('logApp')) logApp('info', 'CHAT', "Message inserted successfully. ID: $message_id");

            // Broadcast: If send_email or send_sms is checked for a global message
            if ($receiver_id === null && ($send_email || $send_sms)) {
                if (function_exists('logApp')) logApp('info', 'CHAT', "Starting staff broadcast (Email: $send_email, SMS: $send_sms)");
                $notifier = new NotificationService();
                $staffStmt = $pdo->prepare("SELECT name, email, phone FROM users WHERE role IN ('super', 'admin', 'store_manager', 'pos_cashier') AND id != ?");
                $staffStmt->execute([$user['id']]);
                $staffList = $staffStmt->fetchAll(PDO::FETCH_ASSOC);
                $config = $GLOBALS['config'] ?? require_once __DIR__ . '/config.php';
                
                $emailsSent = 0;
                $smsSent = 0;

                foreach ($staffList as $staffMem) {
                    $prefix = $is_pinned ? "⚠️ URGENT PINNED UPDATE" : "📢 STAFF BROADCAST";
                    
                    if ($send_email && !empty($staffMem['email'])) {
                        $subject = $is_pinned ? "Urgent Staff Broadcast" : "New Staff Broadcast";
                        $emailMsg = "Hello {$staffMem['name']},\n\n{$user['name']} posted: \"{$message}\"\n\nLog in: " . $config['APP_URL'] . "/staff-chat";
                        $notifier->queueNotification('email', $staffMem['email'], $emailMsg, $subject);
                        $emailsSent++;
                    }

                    if ($send_sms && !empty($staffMem['phone'])) {
                        $smsMsg = eh_brand_site_name() . " {$prefix}: \"{$message}\" - From: {$user['name']}";
                        $notifier->queueNotification('sms', $staffMem['phone'], substr($smsMsg, 0, 160));
                        $smsSent++;
                    }
                }
                $broadcastResult = "Broadcast complete. Emails: $emailsSent, SMS: $smsSent";
                if (function_exists('logApp')) logApp('info', 'CHAT', $broadcastResult);
            }

            echo json_encode([
                'success' => true, 
                'message' => 'Message sent successfully', 
                'message_id' => $message_id,
                'broadcast_info' => $broadcastResult ?? null
            ]);
        } catch (Exception $e) {
            sendDatabaseError($e, 'Unable to send message due to a system issue.');
        }
        exit;
    }

    if ($action === 'pin') {
        // Only admins/managers/super can toggle pins
        if (!in_array($user['role'], ['super', 'admin', 'store_manager'])) {
            echo json_encode(['error' => 'Only admins and managers can pin messages']);
            exit;
        }

        $message_id = (int)($data['message_id'] ?? 0);
        $is_pinned = !empty($data['is_pinned']) ? 1 : 0;
        $pinned_by = $is_pinned ? $user['id'] : null;

        $stmt = $pdo->prepare("UPDATE admin_messages SET is_pinned = ?, pinned_by = ? WHERE id = ? AND receiver_id IS NULL");
        $stmt->execute([$is_pinned, $pinned_by, $message_id]);

        echo json_encode(['success' => true]);
        exit;
    }

    if ($action === 'mark_read') {
        $with_user = (int)($data['with_user'] ?? 0);
        if ($with_user <= 0) {
            echo json_encode(['success' => false, 'error' => 'Invalid user ID']);
            exit;
        }

        // Ownership check: only mark messages as read for conversations that involve the current user
        $stmt = $pdo->prepare(
            "UPDATE admin_messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?"
        );
        $stmt->execute([$with_user, $user['id']]);

        echo json_encode(['success' => true]);
        exit;
    }
}

echo json_encode(['error' => 'Invalid action']);
?>
