<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/security.php';

header('Content-Type: application/json');

// Get active user
$userId = authenticate($pdo);
if (!$userId) {
    echo json_encode(['error' => 'Authentication required']);
    exit;
}

$role = getUserRole($userId, $pdo);

// Only allow super admins or managers to perform maintenance
if (!in_array($role, ['super', 'admin', 'store_manager'])) {
    echo json_encode(['error' => 'Permission denied. Only admins can perform maintenance.']);
    exit;
}

$action = $_GET['action'] ?? '';
$data = json_decode(file_get_contents('php://input'), true) ?? [];

if ($action === 'stats') {
    try {
        // Total messages
        $stmt = $pdo->query("SELECT COUNT(*) FROM admin_messages");
        $totalMessages = $stmt->fetchColumn();

        // Pinned messages
        $stmt = $pdo->query("SELECT COUNT(*) FROM admin_messages WHERE is_pinned = 1");
        $pinnedCount = $stmt->fetchColumn();

        // Attachments
        $stmt = $pdo->query("SELECT COUNT(*) FROM admin_messages WHERE attachment_url IS NOT NULL");
        $attachmentCount = $stmt->fetchColumn();

        // Oldest message
        $stmt = $pdo->query("SELECT MIN(created_at) FROM admin_messages");
        $oldestDate = $stmt->fetchColumn();

        // Traffic logs
        $stmt = $pdo->query("SELECT COUNT(*) FROM traffic_logs");
        $trafficCount = (int)$stmt->fetchColumn();

        echo json_encode([
            'success' => true,
            'stats' => [
                'total_messages' => (int)$totalMessages,
                'pinned_messages' => (int)$pinnedCount,
                'with_attachments' => (int)$attachmentCount,
                'traffic_logs' => $trafficCount,
                'oldest_message' => $oldestDate
            ]
        ]);
    } catch (Exception $e) {
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'prune') {
    $days = (int)($data['days'] ?? 180);
    if ($days < 30) $days = 30; // Min 30 days safety

    try {
        // We calculate the cutoff date
        $cutoff = date('Y-m-d H:i:s', strtotime("-$days days"));

        // Count how many we'll delete (excluding pinned messages for safety)
        $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM admin_messages WHERE created_at < ? AND is_pinned = 0");
        $checkStmt->execute([$cutoff]);
        $count = $checkStmt->fetchColumn();

        if ($count > 0) {
            // Delete messages (excluding pinned)
            $delStmt = $pdo->prepare("DELETE FROM admin_messages WHERE created_at < ? AND is_pinned = 0");
            $delStmt->execute([$cutoff]);
        }

        echo json_encode([
            'success' => true,
            'message' => "Pruning complete. Removed $count messages older than $days days.",
            'deleted_count' => (int)$count
        ]);
    } catch (Exception $e) {
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'clean_orphans') {
    $uploadDir = __DIR__ . '/uploads/chat/';
    if (!is_dir($uploadDir)) {
        echo json_encode(['success' => true, 'message' => 'Upload directory does not exist.', 'cleaned_count' => 0]);
        exit;
    }

    try {
        // Get all attachment URLs from DB
        $stmt = $pdo->query("SELECT attachment_url FROM admin_messages WHERE attachment_url IS NOT NULL");
        $dbFiles = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        // Normalize paths to just basenames for comparison
        $dbBasenames = array_map(function($path) {
            return basename($path);
        }, $dbFiles);

        // Scan the actual directory
        $allFiles = scandir($uploadDir);
        $cleaned = 0;

        foreach ($allFiles as $file) {
            if ($file === '.' || $file === '..') continue;
            
            // If the file on disk is NOT in the database list, it's an orphan
            if (!in_array($file, $dbBasenames)) {
                @unlink($uploadDir . $file);
                $cleaned++;
            }
        }

        echo json_encode([
            'success' => true,
            'message' => "Orphan cleanup complete. Removed $cleaned unused files from storage.",
            'cleaned_count' => $cleaned
        ]);
    } catch (Exception $e) {
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'clear_traffic') {
    try {
        $stmt = $pdo->query("SELECT COUNT(*) FROM traffic_logs");
        $count = (int)$stmt->fetchColumn();

        if ($count > 0) {
            $pdo->exec("TRUNCATE TABLE traffic_logs");
        }

        echo json_encode([
            'success' => true,
            'message' => "Traffic logs cleared successfully. Removed $count entries.",
            'cleared_count' => $count
        ]);
    } catch (Exception $e) {
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

echo json_encode(['error' => 'Invalid maintenance action']);
