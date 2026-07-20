<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once 'db.php';

try {
    $indexesAdded = [];

    // Add index on site_analytics.last_visit for querying recent visitors
    try {
        $pdo->exec("CREATE INDEX idx_last_visit ON site_analytics(last_visit)");
        $indexesAdded[] = 'idx_last_visit';
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'Duplicate key name') === false) {
            throw $e;
        }
    }

    // Add index on site_analytics.is_registered for filtering registered users
    try {
        $pdo->exec("CREATE INDEX idx_is_registered ON site_analytics(is_registered)");
        $indexesAdded[] = 'idx_is_registered';
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'Duplicate key name') === false) {
            throw $e;
        }
    }

    // Add index on site_analytics_history.date for time-based queries
    try {
        $pdo->exec("CREATE INDEX idx_history_date ON site_analytics_history(date)");
        $indexesAdded[] = 'idx_history_date';
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'Duplicate key name') === false) {
            throw $e;
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Database indexes added successfully',
        'indexes_added' => $indexesAdded
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Failed to add database indexes: ' . $e->getMessage()
    ]);
}
