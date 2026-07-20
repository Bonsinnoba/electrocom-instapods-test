<?php
require 'cors_middleware.php';
require 'db.php';
require 'security.php';

header('Content-Type: application/json');

// Authenticate and check for admin roles
try {
    $userId = authenticate();
    $role = getUserRole($userId, $pdo);
    $userName = getUserName($userId, $pdo);
    
    // Require super or marketing/admin role
    requireRole(['super', 'store_manager', 'marketing'], $pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $col = $pdo->query("SHOW COLUMNS FROM users LIKE 'role'")->fetch(PDO::FETCH_ASSOC);
        $roles = ['customer'];
        if ($col && isset($col['Type'])) {
            if (preg_match("/^enum\((.*)\)$/i", $col['Type'], $m)) {
                $parts = array_map('trim', explode(',', $m[1]));
                $roles = array_map(function ($v) {
                    return trim($v, " '\"");
                }, $parts);
            }
        }
        echo json_encode(['success' => true, 'data' => $roles]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
} elseif ($method === 'POST') {
    $content = trim(file_get_contents("php://input"));
    $decoded = json_decode($content, true);
    
    $type = $decoded['type'] ?? 'email'; // 'email', 'sms', or 'both'
    $target = $decoded['target'] ?? 'all'; // 'all', 'verified', 'standard'
    $roleTargets = $decoded['role_targets'] ?? ['customer'];
    $title = sanitizeInput($decoded['title'] ?? '');
    $message = sanitizeInput($decoded['message'] ?? '');
    
    if (empty($message)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Message content is required']);
        exit;
    }

    try {
        // Fetch targets based on selection
        if (!is_array($roleTargets) || empty($roleTargets)) {
            $roleTargets = ['customer'];
        }
        $roleTargets = array_values(array_unique(array_map('sanitizeInput', $roleTargets)));
        $placeholders = implode(',', array_fill(0, count($roleTargets), '?'));

        $query = "SELECT id, email, phone, name, role, email_notif, sms_tracking FROM users WHERE role IN ($placeholders)";
        $params = $roleTargets;

        // Backward-compatible audience filters for customer role only
        if (in_array('customer', $roleTargets, true)) {
            if ($target === 'verified') {
                $query .= " AND (role != 'customer' OR is_verified = 1)";
            } elseif ($target === 'standard') {
                $query .= " AND (role != 'customer' OR (is_verified = 0 OR is_verified IS NULL))";
            }
        }

        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $users = $stmt->fetchAll();

        if (empty($users)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => "No users matched selected roles/filters. Broadcast was not sent."
            ]);
            exit;
        }
        
        require_once 'notifications.php';
        $notifier = new NotificationService();

        $emailCount = 0;
        $smsCount = 0;
        $inAppCount = 0;
        $eligibleCount = 0;

        // Bulk insert in-app notifications (performance optimization)
        $broadcastTitle = !empty($title) ? $title : 'New Broadcast';
        $inAppValues = [];
        $inAppParams = [];

        foreach ($users as $user) {
            $inAppValues[] = "(?, ?, 'promo')";
            $inAppParams[] = $user['id'];
            $inAppParams[] = $broadcastTitle;
            $inAppParams[] = $message;

            // Batch insert every 500 users to prevent memory issues
            if (count($inAppValues) >= 500) {
                $bulkSql = "INSERT INTO notifications (user_id, title, message, type) VALUES " . implode(',', $inAppValues);
                $pdo->prepare($bulkSql)->execute($inAppParams);
                $inAppCount += count($inAppValues);
                $inAppValues = [];
                $inAppParams = [];
            }
        }

        // Insert remaining batch
        if (!empty($inAppValues)) {
            $bulkSql = "INSERT INTO notifications (user_id, title, message, type) VALUES " . implode(',', $inAppValues);
            $pdo->prepare($bulkSql)->execute($inAppParams);
            $inAppCount += count($inAppValues);
        }

        // Process email/SMS queueing (still sequential but much faster without DB writes)
        foreach ($users as $user) {
            $hadEligibleChannel = false;

            // Send Email if applicable
            if (($type === 'email' || $type === 'both') && !empty($user['email'])) {
                if ($user['email_notif']) {
                    $hadEligibleChannel = true;
                    $emailPayload = [
                        'broadcast' => true,
                        'audience_role' => $user['role'] ?? 'unknown',
                        'channel' => 'email',
                    ];
                    if ($notifier->queueNotification('email', $user['email'], $message, $title, $emailPayload)) {
                        $emailCount++;
                    }
                }
            }

            // Send SMS if applicable
            if (($type === 'sms' || $type === 'both') && !empty($user['phone'])) {
                if ($user['sms_tracking']) {
                    $hadEligibleChannel = true;
                    $smsPayload = [
                        'broadcast' => true,
                        'audience_role' => $user['role'] ?? 'unknown',
                        'channel' => 'sms',
                    ];
                    if ($notifier->queueNotification('sms', $user['phone'], $message, null, $smsPayload)) {
                        $smsCount++;
                    }
                }
            }

            if ($hadEligibleChannel) {
                $eligibleCount++;
            }
        }

        if (($type === 'sms' || $type === 'both') && $smsCount === 0) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'No SMS were queued. Target users may be missing phone numbers or have SMS notifications disabled.',
                'stats' => [
                    'targeted_users' => count($users),
                    'emails' => $emailCount,
                    'sms' => $smsCount,
                    'in_app' => $inAppCount
                ]
            ]);
            exit;
        }
        
        logger('info', 'BROADCAST', "Mass broadcast sent by {$userName}. Type: {$type}, Roles: " . implode(',', $roleTargets) . ", Target: {$target}. Emails: {$emailCount}, SMS: {$smsCount}");
        
        echo json_encode([
            'success' => true, 
            'message' => 'Broadcast sent successfully',
            'stats' => [
                'emails' => $emailCount,
                'sms' => $smsCount,
                'in_app' => $inAppCount,
                'targeted_users' => count($users),
                'eligible_channel_users' => $eligibleCount,
                'total_reached' => $inAppCount
            ]
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
