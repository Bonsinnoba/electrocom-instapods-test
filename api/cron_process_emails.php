<?php
/**
 * Background worker to process email queue.
 * Run via cron: php cron_process_emails.php
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/email/EmailEngine.php';

$engine = new EmailEngine($pdo, $config);
$heartbeatFile = __DIR__ . '/data/email_worker_heartbeat.txt';
$heartbeatDir = dirname($heartbeatFile);
if (!is_dir($heartbeatDir)) {
    @mkdir($heartbeatDir, 0755, true);
}

try {
    $engine->processQueue(50);
} catch (Throwable $e) {
    logger('error', 'EMAIL_WORKER', 'Fatal email worker error: ' . $e->getMessage());
}

@file_put_contents($heartbeatFile, gmdate('c') . "\n" . (function_exists('gethostname') ? gethostname() : 'worker'), LOCK_EX);
