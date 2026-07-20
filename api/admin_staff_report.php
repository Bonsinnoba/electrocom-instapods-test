<?php
/**
 * admin_staff_report.php
 * Generates a downloadable CSV report of staff activities for the past 7 days.
 * Requires super, admin, or accountant role.
 */

require 'cors_middleware.php';
require 'db.php';
require 'security.php';

// Since this is downloaded via an anchor tag, we use a secure short-lived single-use download token
$dlToken = $_GET['dl_token'] ?? '';
$token = $_GET['token'] ?? '';

$isValid = false;
$userId = null;
$userRole = null;

if (!empty($dlToken)) {
    $tokenFile = __DIR__ . '/data/report_tokens.json';
    if (file_exists($tokenFile)) {
        $tokens = json_decode(file_get_contents($tokenFile), true) ?: [];
        $now = time();
        $activeTokens = [];
        foreach ($tokens as $t => $meta) {
            if (isset($meta['expires_at']) && $meta['expires_at'] > $now) {
                $activeTokens[$t] = $meta;
            }
        }
        if (isset($activeTokens[$dlToken])) {
            $isValid = true;
            $userId = $activeTokens[$dlToken]['user_id'];
            $userRole = $activeTokens[$dlToken]['role'];
            unset($activeTokens[$dlToken]); // Consume one-time token
        }
        file_put_contents($tokenFile, json_encode($activeTokens, JSON_PRETTY_PRINT));
    }
} elseif (!empty($token)) {
    // Legacy support for backward compatibility
    try {
        $parts = explode('.', $token);
        if (count($parts) === 3) {
            $config = $GLOBALS['config'] ?? require 'config.php';
            $secret = $config['JWT_SECRET'] ?? '';
            $headerAndPayload = $parts[0] . '.' . $parts[1];
            
            $expectedSig = hash_hmac('sha256', $headerAndPayload, $secret, true);
            $encodedSig = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($expectedSig));

            if (hash_equals($encodedSig, $parts[2])) {
                $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[1])), true);
                if (isset($payload['exp']) && $payload['exp'] >= time()) {
                    $userId = $payload['user_id'] ?? null;
                    if ($userId) {
                        $stmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
                        $stmt->execute([$userId]);
                        $userRole = $stmt->fetchColumn();
                        if ($userRole) {
                            $isValid = true;
                        }
                    }
                }
            }
        }
    } catch (Exception $e) {}
}

if (!$isValid) {
    http_response_code(401);
    die("Unauthorized: Missing or invalid token.");
}

$allowedRoles = ['super', 'store_manager', 'accountant'];
if (!in_array($userRole, $allowedRoles, true)) {
    http_response_code(403);
    die("Forbidden: Insufficient permissions.");
}

// If downloading an archived file
$archiveFile = $_GET['file'] ?? '';
if (!empty($archiveFile)) {
    $archiveFile = basename($archiveFile); // Path traversal protection
    $filePath = __DIR__ . '/data/reports/' . $archiveFile;
    if (file_exists($filePath) && preg_match('/\.csv$/', $archiveFile)) {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $archiveFile . '"');
        header('Pragma: no-cache');
        header('Expires: 0');
        readfile($filePath);
        exit;
    } else {
        http_response_code(404);
        die("Report not found.");
    }
}

// Fetch all staff users mapping
try {
    $staffStmt = $pdo->query("SELECT id, name, role FROM users WHERE role != 'customer'");
    $staffList = [];
    while ($row = $staffStmt->fetch(PDO::FETCH_ASSOC)) {
        $staffList[$row['id']] = [
            'name' => $row['name'],
            'role' => strtoupper($row['role'])
        ];
    }
} catch (Exception $e) {
    http_response_code(500);
    die("Database Error.");
}

$daysToFetch = 7;
$logDir = __DIR__ . '/logs';
$reportData = [];

// Read logs backwards starting from today
for ($i = 0; $i < $daysToFetch; $i++) {
    $dateStr = date('Y-m-d', strtotime("-$i days"));
    $logFile = $logDir . '/app-' . $dateStr . '.log';

    if (file_exists($logFile)) {
        $lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            // Clean non-UTF8 characters
            $line = mb_convert_encoding($line, 'UTF-8', 'UTF-8');

            // Match log format: YYYY-MM-DD HH:MM:SS [LEVEL] [SOURCE] [METHOD URI] [IP] [UID:X] message
            if (preg_match('/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+\[(\w+)\]\s+\[([^\]]+)\]\s+.*\[UID:(\d+)\]\s+(.+)$/', $line, $m)) {
                $ts = $m[1];
                $level = strtoupper($m[2]);
                $source = $m[3];
                $uid = $m[4];
                $msg = $m[5];

                if (isset($staffList[$uid])) {
                    $staffName = $staffList[$uid]['name'];
                    $staffRole = $staffList[$uid]['role'];

                    $datePart = date('Y-m-d', strtotime($ts));
                    $timePart = date('h:i:s A', strtotime($ts));

                    $reportData[] = [
                        $ts, // Keep original timestamp for sorting internally
                        $datePart,
                        $timePart,
                        $staffName,
                        $staffRole,
                        $source,
                        $level,
                        $msg
                    ];
                }
            }
        }
    }
}

// Sort by timestamp descending
usort($reportData, function($a, $b) {
    return strcmp($b[0], $a[0]);
});

// Output CSV
$filename = "staff_activity_report_" . date('Y-m-d') . ".csv";

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Pragma: no-cache');
header('Expires: 0');

$output = fopen('php://output', 'w');

// UTF-8 BOM for Excel compatibility
fputs($output, "\xEF\xBB\xBF");

// Headers
fputcsv($output, ['Date', 'Time', 'Staff Name', 'Role', 'System Module', 'Severity', 'Task Performed']);

foreach ($reportData as $row) {
    // Remove the original sorting timestamp from the final output
    array_shift($row);
    fputcsv($output, $row);
}

fclose($output);
exit;
