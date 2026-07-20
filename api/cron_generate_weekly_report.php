<?php
/**
 * api/cron_generate_weekly_report.php
 * Automated background task to generate weekly staff activity reports.
 */

require_once __DIR__ . '/db.php';

function generateWeeklyReport($pdo) {
    try {
        $reportsDir = __DIR__ . '/data/reports';
        if (!is_dir($reportsDir)) {
            mkdir($reportsDir, 0755, true);
        }

        // Determine the "last week". 
        // In PHP, 'last week monday' gets the start of the previous ISO week.
        $lastWeekStart = strtotime('last week monday');
        
        $year = date('Y', $lastWeekStart);
        $weekNum = date('W', $lastWeekStart);
        
        $filename = "staff_activity_report_{$year}-W{$weekNum}.csv";
        $filepath = $reportsDir . '/' . $filename;
        
        if (file_exists($filepath)) {
            return; // Already generated
        }
        
        // Fetch staff
        $staffStmt = $pdo->query("SELECT id, name, role FROM users WHERE role != 'customer'");
        $staffList = [];
        while ($row = $staffStmt->fetch(PDO::FETCH_ASSOC)) {
            $staffList[$row['id']] = ['name' => $row['name'], 'role' => strtoupper($row['role'])];
        }
        
        $logDir = __DIR__ . '/logs';
        $reportData = [];
        
        // Read the 7 days of last week
        for ($i = 0; $i < 7; $i++) {
            $dateStr = date('Y-m-d', $lastWeekStart + ($i * 86400));
            $logFile = $logDir . '/app-' . $dateStr . '.log';
            
            if (file_exists($logFile)) {
                $lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                foreach ($lines as $line) {
                    $line = mb_convert_encoding($line, 'UTF-8', 'UTF-8');
                    if (preg_match('/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+\[(\w+)\]\s+\[([^\]]+)\]\s+\[UID:(\d+)\]\s+(.+)$/', $line, $m)) {
                        $ts = $m[1];
                        $level = strtoupper($m[2]);
                        $source = $m[3];
                        $uid = $m[4];
                        $msg = $m[5];
                        
                        if (isset($staffList[$uid])) {
                            $datePart = date('Y-m-d', strtotime($ts));
                            $timePart = date('h:i:s A', strtotime($ts));
                            $reportData[] = [$ts, $datePart, $timePart, $staffList[$uid]['name'], $staffList[$uid]['role'], $source, $level, $msg];
                        }
                    }
                }
            }
        }
        
        usort($reportData, function($a, $b) {
            return strcmp($b[0], $a[0]);
        });
        
        $output = fopen($filepath, 'w');
        fputs($output, "\xEF\xBB\xBF");
        fputcsv($output, ['Date', 'Time', 'Staff Name', 'Role', 'System Module', 'Severity', 'Task Performed']);
        
        foreach ($reportData as $row) {
            array_shift($row); // remove sorting timestamp
            fputcsv($output, $row);
        }
        fclose($output);

        if (function_exists('logger')) {
            logger('info', 'SYSTEM', "Weekly report {$filename} archived automatically.");
        }
    } catch (Exception $e) {
        error_log("Failed to generate weekly report: " . $e->getMessage());
    }
}

// Allow manual execution directly or via include
if (php_sapi_name() === 'cli' || basename(__FILE__) === basename($_SERVER['PHP_SELF'])) {
    generateWeeklyReport($pdo);
    echo "Weekly report generation completed.\n";
}
