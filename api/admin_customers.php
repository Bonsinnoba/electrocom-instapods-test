<?php
require 'cors_middleware.php';
require 'db.php';
require 'security.php';

header('Content-Type: application/json');

// Authenticate User
try {
    $userId = authenticate();
    $role = getUserRole($userId, $pdo);
    $userName = getUserName($userId, $pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

// Granular Role Access
try {
    if ($method === 'GET') {
        // Basic audit: Store Managers, Accountants, Super
        requireRole(RBAC_ALL_ADMINS, $pdo);
    } elseif ($method === 'POST') {
        // Moderation: Store Managers only
        requireRole(['super', 'store_manager'], $pdo);
    }
} catch (Exception $e) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
}

if ($method === 'GET') {
    try {
        $filterSql = "";
        $params = [];

        // Restriction: managers only see 'customer' role users for data privacy
        if ($role === 'store_manager') {
            $filterSql = " WHERE u.role = 'customer' ";
        }

        // Fetch all users with basic order summary and branch name
        $stmt = $pdo->prepare("
            SELECT
                u.id, u.name, u.email, u.phone, u.address, u.role, u.level, u.level_name, u.avatar_text, u.status, u.created_at,
                (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as orders_count,
                (SELECT SUM(total_amount) FROM orders WHERE user_id = u.id) as total_spent
            FROM users u
            $filterSql
            ORDER BY u.created_at DESC
        ");
        $stmt->execute($params);
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Final safety check
        foreach ($users as &$user) {
            unset($user['password_hash']); // Should be excluded from SELECT anyway, but double safe
        }

        echo json_encode(['success' => true, 'data' => $users]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
} elseif ($method === 'POST') {
    $content = trim(file_get_contents("php://input"));
    $decoded = json_decode($content, true);
    $action = $decoded['action'] ?? '';

    if ($action === 'delete') {
        $id = $decoded['id'] ?? null;
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'User ID is required']);
            exit;
        }

        try {
            // SECURITY: Ensure non-super admins cannot delete super admins
            if ($role !== 'super') {
                $check = $pdo->prepare("SELECT role FROM users WHERE id = ?");
                $check->execute([$id]);
                $targetRole = $check->fetchColumn();
                if ($targetRole === 'super') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'message' => 'Permission denied: Cannot delete super admin.']);
                    exit;
                }
            }

            // Immediately anonymize the user's PII instead of a hard DELETE.
            // This preserves Order/Financial foreign key integrity while fully erasing personal data.
            $stmt = $pdo->prepare("
                UPDATE users
                SET email = CONCAT('anonymized_', id, '@deleted.local'),
                    password_hash = 'ERASED',
                    name = 'Data Erased',
                    phone = NULL,
                    address = NULL,
                    deleted_at = NOW(),
                    status = 'Purged'
                WHERE id = ?
            ");
            $stmt->execute([$id]);

            logger('warn', 'STAFF', "User ID: {$id} was immediately anonymized (PII erased) by {$userName}");

            // Log audit with error handling
            try {
                logAdminAudit($pdo, $userId, 'user.anonymize', 'user', (string)$id, []);
            } catch (Exception $auditError) {
                error_log('Audit log failed: ' . $auditError->getMessage());
            }

            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    } elseif ($action === 'toggle_status') {
        $id = $decoded['id'] ?? null;
        $currentStatus = $decoded['status'] ?? 'Active';

        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'User ID is required']);
            exit;
        }

        try {
            $pdo->beginTransaction();
            
            // Lock user row to prevent race conditions with concurrent admin actions
            $lockStmt = $pdo->prepare("SELECT status FROM users WHERE id = ? FOR UPDATE");
            $lockStmt->execute([$id]);
            $lockedStatus = $lockStmt->fetchColumn();
            
            if (!$lockedStatus) {
                $pdo->rollBack();
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'User not found']);
                exit;
            }
            
            $newStatus = ($currentStatus === 'Suspended') ? 'Active' : 'Suspended';
            $stmt = $pdo->prepare("UPDATE users SET status = ? WHERE id = ?");
            $stmt->execute([$newStatus, $id]);

            logger('info', 'STAFF', "User ID: {$id} status updated to {$newStatus} by {$userName}");

            // Log audit with error handling
            try {
                logAdminAudit($pdo, $userId, 'user.status.update', 'user', (string)$id, ['status' => $newStatus]);
            } catch (Exception $auditError) {
                error_log('Audit log failed: ' . $auditError->getMessage());
            }

            $pdo->commit();

            echo json_encode(['success' => true, 'status' => $newStatus]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    } elseif ($action === 'set_role') {
        $id = $decoded['id'] ?? null;
        $newRole = $decoded['role'] ?? 'customer';

        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'User ID is required']);
            exit;
        }

        try {
            $pdo->beginTransaction();
            
            // Lock user row to prevent race conditions with concurrent admin actions
            $lockStmt = $pdo->prepare("SELECT role FROM users WHERE id = ? FOR UPDATE");
            $lockStmt->execute([$id]);
            $targetUser = $lockStmt->fetch();

            if (!$targetUser) {
                $pdo->rollBack();
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'User not found']);
                exit;
            }

            $currentRole = $targetUser['role'];

            // Security Check: Only a super admin can alter a super admin, 
            // or assign the super admin role to someone else.
            if (($currentRole === 'super' || $newRole === 'super') && $role !== 'super') {
                $pdo->rollBack();
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Permission denied: Super admin privileges required.']);
                exit;
            }

            $stmt = $pdo->prepare("UPDATE users SET role = ? WHERE id = ?");
            $stmt->execute([$newRole, $id]);

            logger('info', 'STAFF', "User ID: {$id} role updated to " . strtoupper($newRole) . " by {$userName}");

            // Log audit with error handling
            try {
                logAdminAudit($pdo, $userId, 'user.role.update', 'user', (string)$id, ['role' => $newRole]);
            } catch (Exception $auditError) {
                error_log('Audit log failed: ' . $auditError->getMessage());
                // Continue with commit even if audit fails
            }

            $pdo->commit();

            echo json_encode(['success' => true, 'role' => $newRole]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }

    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
