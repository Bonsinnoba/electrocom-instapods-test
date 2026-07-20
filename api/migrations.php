<?php
/**
 * ElectrCom - Database Migration Runner
 * Manages schema updates by tracking executed SQL files in the migrations/ folder.
 */

require_once __DIR__ . '/security.php';

function runMigrations($pdo) {
    try {
        // 1. Ensure migrations table exists
        $pdo->exec("CREATE TABLE IF NOT EXISTS migrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");

        $migrationDir = __DIR__ . '/migrations';
        if (!is_dir($migrationDir)) return;

        $files = scandir($migrationDir);
        sort($files);

        $executedCount = 0;

        foreach ($files as $file) {
            if (pathinfo($file, PATHINFO_EXTENSION) !== 'sql') continue;

            // Check if already executed
            $stmt = $pdo->prepare("SELECT id FROM migrations WHERE filename = ?");
            $stmt->execute([$file]);
            $alreadyRan = (bool)$stmt->fetch();
            $stmt->closeCursor();
            if ($alreadyRan) continue;

            // Execute file
            try {
                $sql = file_get_contents($migrationDir . '/' . $file);
                if (empty(trim($sql))) continue;

                // Handle DELIMITER commands often found in procedures/triggers
                if (preg_match('/DELIMITER\s+(\S+)/i', $sql, $matches)) {
                    $customDelim = $matches[1];
                    // Strip the DELIMITER lines
                    $sql = preg_replace('/DELIMITER\s+\S+\s*/i', '', $sql);
                    $statements = array_filter(array_map('trim', explode($customDelim, $sql)));
                } else {
                    // Simple split for standard SQL
                    // Replace comment lines first to avoid splitting inside comments
                    $sql = preg_replace('/^--.*$/m', '', $sql);
                    $statements = array_filter(array_map('trim', explode(';', $sql)));
                }
                
                $pdo->beginTransaction();
                foreach ($statements as $s) {
                    if ($s) {
                        try {
                            $pdo->exec($s);
                        } catch (Exception $execE) {
                            // If it's just "Procedure already exists", we can ignore if desired,
                            // but usually it's better to log and throw.
                            throw $execE;
                        }
                    }
                }
                
                // Log execution
                $logStmt = $pdo->prepare("INSERT INTO migrations (filename) VALUES (?)");
                $logStmt->execute([$file]);
                $logStmt->closeCursor();
                
                if ($pdo->inTransaction()) $pdo->commit();
                $executedCount++;
                if (function_exists('logger')) logger('ok', 'MIGRATION', "Successfully executed $file");
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                if (function_exists('logger')) logger('error', 'MIGRATION', "Failed executing $file: " . $e->getMessage());
                break; // Stop on error
            }
        }
        
        return $executedCount;
    } catch (Exception $e) {
        if (function_exists('logger')) logger('error', 'MIGRATION_RUNNER', $e->getMessage());
        return 0;
    }
}

// If calling directly (e.g. via CLI or Cron)
if (basename($_SERVER['SCRIPT_FILENAME']??'') === 'migrations.php') {
    require_once 'db.php';
    // if (!isSuperAdmin($pdo)) {
    //     header('Content-Type: application/json');
    //     echo json_encode(['error' => 'Super admin required']);
    //     exit;
    // }
    $count = runMigrations($pdo);
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'executed' => $count]);
}
