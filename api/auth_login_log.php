<?php
/**
 * Persists successful authentication events (local password, Google, GitHub OAuth).
 */

if (!function_exists('ensureAuthLoginLogTable')) {
    function ensureAuthLoginLogTable(PDO $pdo): void
    {
        static $done = false;
        if ($done) {
            return;
        }
        $pdo->exec("CREATE TABLE IF NOT EXISTS auth_login_log (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            provider VARCHAR(32) NOT NULL,
            ip_address VARCHAR(45) DEFAULT NULL,
            user_agent VARCHAR(512) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_created_at (created_at),
            INDEX idx_user_time (user_id, created_at),
            CONSTRAINT fk_auth_login_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $done = true;
    }
}

if (!function_exists('logSuccessfulAuthLogin')) {
    /**
     * @param string $provider local|google|github
     */
    function logSuccessfulAuthLogin(PDO $pdo, int $userId, string $provider): void
    {
        $provider = strtolower(preg_replace('/[^a-z0-9_-]/', '', $provider));
        if (!in_array($provider, ['local', 'google', 'github'], true)) {
            $provider = 'local';
        }
        try {
            ensureAuthLoginLogTable($pdo);
            $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
            if (is_string($ip) && strpos($ip, ',') !== false) {
                $ip = trim(explode(',', $ip)[0]);
            }
            $ip = substr((string) $ip, 0, 45);
            $ua = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 512);
            $stmt = $pdo->prepare('INSERT INTO auth_login_log (user_id, provider, ip_address, user_agent) VALUES (?, ?, ?, ?)');
            $stmt->execute([$userId, $provider, $ip !== '' ? $ip : null, $ua !== '' ? $ua : null]);
        } catch (Throwable $e) {
            error_log('logSuccessfulAuthLogin: ' . $e->getMessage());
        }
    }
}
