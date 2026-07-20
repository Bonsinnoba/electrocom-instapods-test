<?php
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

// Allow OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// User must be logged in
$user = authenticate($pdo);
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$userId = $user['id'];

try {
    // 1. Calculate total spend from completed orders
    $stmt = $pdo->prepare("
        SELECT SUM(total_amount) 
        FROM orders 
        WHERE user_id = ? AND status IN ('delivered', 'completed')
    ");
    $stmt->execute([$userId]);
    $totalSpend = (float)$stmt->fetchColumn() ?: 0;

    // 2. Determine Level based on spend
    // Starter: 0-500, Elite: 500-2000, VIP: 2000+
    $levelName = "Starter";
    $levelNum = 1;
    $nextLevelThreshold = 500;
    $progress = 0;

    if ($totalSpend >= 2000) {
        $levelName = "VIP";
        $levelNum = 3;
        $nextLevelThreshold = null;
        $progress = 100;
    } elseif ($totalSpend >= 500) {
        $levelName = "Elite";
        $levelNum = 2;
        $nextLevelThreshold = 2000;
        $progress = round((($totalSpend - 500) / (2000 - 500)) * 100, 1);
    } else {
        $levelName = "Starter";
        $levelNum = 1;
        $nextLevelThreshold = 500;
        $progress = round(($totalSpend / 500) * 100, 1);
    }

    // 3. Update user level in DB if it changed
    $stmt = $pdo->prepare("UPDATE users SET level = ?, level_name = ? WHERE id = ? AND (level != ? OR level_name != ? OR level_name IS NULL)");
    $stmt->execute([$levelNum, $levelName, $userId, $levelNum, $levelName]);

    echo json_encode([
        'success' => true,
        'data' => [
            'total_spend' => $totalSpend,
            'current_level' => $levelName,
            'level_number' => $levelNum,
            'next_level_threshold' => $nextLevelThreshold,
            'progress_percent' => $progress
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
