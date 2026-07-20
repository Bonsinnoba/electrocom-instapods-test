<?php
/**
 * Background worker to prune expired revoked tokens from the blacklist.
 * Run via cron or manual trigger: php cron_prune_revoked_tokens.php
 * 
 * This is a hygiene task to prevent the revoked_tokens table from growing indefinitely.
 * Tokens are removed after their natural expiration time has passed.
 * 
 * Recommended crontab: 0 2 * * * php /path/to/api/cron_prune_revoked_tokens.php
 */

require_once 'db.php';

try {
    // Delete tokens that have expired (their natural expiration time has passed)
    $stmt = $pdo->prepare("DELETE FROM revoked_tokens WHERE expires_at < NOW()");
    $deleted = $stmt->execute();
    $rowCount = $stmt->rowCount();

    if ($rowCount > 0) {
        logger('ok', 'TOKEN_PRUNE', "Pruned {$rowCount} expired revoked tokens.");
    }

} catch (Exception $e) {
    logger('error', 'TOKEN_PRUNE', "Failed to prune revoked tokens: " . $e->getMessage());
}
