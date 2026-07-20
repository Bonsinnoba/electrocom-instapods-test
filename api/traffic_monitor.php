<?php
// api/traffic_monitor.php
// --- Self-healing Schema ---
if ($config['DB_AUTO_REPAIR'] ?? false) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS traffic_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ip_address VARCHAR(45) NOT NULL,
            country VARCHAR(100),
            request_url TEXT,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS access_restrictions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type ENUM('ip', 'country') NOT NULL,
            value VARCHAR(255) NOT NULL,
            reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY idx_restriction (type, value)
        )");
    } catch (Exception $e) {
        error_log("Traffic monitor schema self-healing failed: " . $e->getMessage());
    }
}

function monitorTraffic()
{
    global $pdo;

    $ip = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
    $url = $_SERVER['REQUEST_URI'] ?? 'Unknown';
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';

    // 0. Filter Noise (Ignore polling and background analytics)
    $exclusions = [
        'get_notifications.php',
        'check_user_status.php',
        'admin_analytics.php',
        'admin_traffic.php',
        'get_site_settings.php',
        'admin_notification_queue.php',
        'cron_', // Ignore all cron triggers
        '.map',   // Ignore source map requests
        '/cache/' // Ignore internal cache hits
    ];

    foreach ($exclusions as $term) {
        if (stripos($url, $term) !== false) {
            return; // Skip logging for this noisy request
        }
    }

    // Real GeoIP detection using ip-api.com (free tier)
    $country = 'Unknown';
    if ($ip === '127.0.0.1' || $ip === '::1') {
        $country = 'Localhost';
    } else {
        // Simple file-based cache to avoid hitting API limits too hard
        $cacheDir = __DIR__ . '/cache/geoip';
        if (!is_dir($cacheDir)) mkdir($cacheDir, 0755, true);
        $cacheFile = $cacheDir . '/' . md5($ip) . '.json';

        if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < 86400)) {
            $geoData = json_decode(file_get_contents($cacheFile), true);
            $country = $geoData['country'] ?? 'Unknown';
        } else {
            $ctx = stream_context_create(['http' => ['timeout' => 2]]);
            $response = @file_get_contents("http://ip-api.com/json/{$ip}?fields=status,country", false, $ctx);
            if ($response) {
                $geoData = json_decode($response, true);
                if ($geoData && $geoData['status'] === 'success') {
                    $country = $geoData['country'];
                    file_put_contents($cacheFile, $response);
                }
            }
        }
    }

    // 1. Check Restrictions
    $stmt = $pdo->prepare("SELECT type, value, reason FROM access_restrictions WHERE (type = 'ip' AND value = ?) OR (type = 'country' AND value = ?)");
    $stmt->execute([$ip, $country]);
    $restriction = $stmt->fetch();

    if ($restriction) {
        http_response_code(403);
        header('Content-Type: application/json');
        if (ob_get_length()) ob_clean();
        echo json_encode([
            'success' => false,
            'restricted' => true,
            'message' => "Access denied from your location or IP.",
            'reason' => $restriction['reason']
        ]);
        exit;
    }

    // 2. Rate Limiting (Auto-Ban)
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM traffic_logs WHERE ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)");
    $stmt->execute([$ip]);
    $requestCount = $stmt->fetchColumn();

    $limit = ($ip === '127.0.0.1' || $ip === '::1') ? 500 : 100; // 500/min for local dev, 100 for public
    if ($requestCount > $limit) {
        $stmt = $pdo->prepare("INSERT IGNORE INTO access_restrictions (type, value, reason) VALUES ('ip', ?, ?)");
        $stmt->execute([$ip, "Auto-Ban: Persistent rate limit exceeded ($requestCount requests in 1 min)"]);

        // Log to system logs
        if (function_exists('logger')) {
            logger('error', 'SECURITY', "IP $ip auto-banned for rate limiting: $requestCount req/min");
        }

        http_response_code(429); // Too Many Requests
        header('Content-Type: application/json');
        if (ob_get_length()) ob_clean();
        echo json_encode(['success' => false, 'message' => 'Too many requests. Your IP has been restricted.']);
        exit;
    }

    // 3. Log Traffic
    try {
        $stmt = $pdo->prepare("INSERT INTO traffic_logs (ip_address, country, request_url, user_agent) VALUES (?, ?, ?, ?)");
        $stmt->execute([$ip, $country, $url, $ua]);
    } catch (Exception $e) {
        // Silently fail traffic logging if DB is busy
    }
}

// Only monitor if not a preflight request and not running in CLI
if (php_sapi_name() !== 'cli' && isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] !== 'OPTIONS') {
    try {
        monitorTraffic();
    } catch (\Throwable $e) {
        // Silently fail traffic monitoring to avoid blocking real users
        error_log("Traffic Monitor Error: " . $e->getMessage());
    }
}
