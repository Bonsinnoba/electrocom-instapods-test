<?php
// api/data_retention_api.php
// API endpoint for managing data retention policies
require 'db.php';
require 'security.php';
require_once 'data_pruning_config.php';

header('Content-Type: application/json');

try {
    // Authenticate Super User
    $userId = requireRole('super', $pdo);
    $userName = getUserName($userId, $pdo);

    $method = $_SERVER['REQUEST_METHOD'];
    $config = require 'data_pruning_config.php';

    if ($method === 'GET') {
        $action = $_GET['action'] ?? 'status';

        if ($action === 'status') {
            // Get current retention status
            $status = [
                'success' => true,
                'enabled' => $config['enabled'],
                'retention_policies' => $config['retention'],
                'archive_settings' => $config['archive'],
                'schedule' => $config['schedule'],
                'safety' => $config['safety'],
            ];

            // Get current database sizes
            $tables = ['orders', 'cart_items', 'system_logs', 'users', 'products'];
            $tableSizes = [];

            foreach ($tables as $table) {
                try {
                    $result = $pdo->query("SELECT COUNT(*) as count FROM `$table`")->fetch(PDO::FETCH_ASSOC);
                    $tableSizes[$table] = $result['count'];
                } catch (PDOException $e) {
                    $tableSizes[$table] = 'N/A';
                }
            }

            $status['table_counts'] = $tableSizes;
            echo json_encode($status);

        } elseif ($action === 'archives') {
            // List available archives
            $archiveDir = $config['archive']['location'];
            if (!is_dir($archiveDir)) {
                echo json_encode(['success' => true, 'archives' => []]);
                exit;
            }

            $files = glob($archiveDir . '/*.json*');
            $archives = [];

            foreach ($files as $file) {
                $archives[] = [
                    'name' => basename($file),
                    'size' => filesize($file),
                    'date' => date('Y-m-d H:i:s', filemtime($file)),
                    'compressed' => strpos($file, '.gz') !== false
                ];
            }

            usort($archives, function ($a, $b) {
                return strtotime($b['date']) - strtotime($a['date']);
            });

            echo json_encode(['success' => true, 'archives' => $archives]);
        }

    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents("php://input"), true);
        $action = $data['action'] ?? '';

        if ($action === 'update_retention') {
            // Update retention policy
            $table = $data['table'] ?? null;
            $days = $data['days'] ?? null;

            if (!$table || !$days) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Table and days are required']);
                exit;
            }

            if (!isset($config['retention'][$table])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid table name']);
                exit;
            }

            // Update config file
            $configFile = __DIR__ . '/data_pruning_config.php';
            $configContent = file_get_contents($configFile);
            
            // Update the specific retention value
            $pattern = "/'$table'\s*=>\s*\d+,/";
            $replacement = "'$table' => $days,";
            $newContent = preg_replace($pattern, $replacement, $configContent);

            if ($newContent === $configContent) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to update config file']);
                exit;
            }

            file_put_contents($configFile, $newContent);

            logger('success', 'SYSTEM', "Retention policy updated for $table: $days days by $userName");
            echo json_encode(['success' => true, 'message' => "Retention policy updated for $table to $days days"]);

        } elseif ($action === 'toggle_pruning') {
            // Enable/disable pruning
            $enabled = $data['enabled'] ?? false;

            $configFile = __DIR__ . '/data_pruning_config.php';
            $configContent = file_get_contents($configFile);
            
            $pattern = "/'enabled'\s*=>\s*(true|false),/";
            $replacement = "'enabled' => " . ($enabled ? 'true' : 'false') . ",";
            $newContent = preg_replace($pattern, $replacement, $configContent);

            if ($newContent === $configContent) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to update config file']);
                exit;
            }

            file_put_contents($configFile, $newContent);

            logger('success', 'SYSTEM', "Data pruning " . ($enabled ? 'enabled' : 'disabled') . " by $userName");
            echo json_encode(['success' => true, 'message' => "Data pruning " . ($enabled ? 'enabled' : 'disabled')]);

        } elseif ($action === 'run_pruner') {
            // Trigger manual pruning run
            $type = $data['type'] ?? 'daily';
            $dryRun = $data['dry_run'] ?? false;

            $command = sprintf(
                'php %s --type=%s %s 2>&1',
                escapeshellarg(__DIR__ . '/data_pruner.php'),
                escapeshellarg($type),
                $dryRun ? '--dry-run' : ''
            );

            $output = [];
            $returnCode = 0;
            exec($command, $output, $returnCode);

            logger('info', 'SYSTEM', "Manual pruning run triggered: $type by $userName");

            echo json_encode([
                'success' => $returnCode === 0,
                'message' => $returnCode === 0 ? 'Pruning completed successfully' : 'Pruning failed',
                'output' => implode("\n", $output),
                'return_code' => $returnCode
            ]);
        }
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
