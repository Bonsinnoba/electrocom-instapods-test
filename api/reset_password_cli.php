<?php
/**
 * reset_password_cli.php
 *
 * Run this directly from the InstaPods terminal — it never touches the web,
 * so there's no token/exposure concern like the HTTP version has.
 *
 * USAGE (from your terminal, inside the api/ folder or adjust the path):
 *   php reset_password_cli.php your@email.com YourNewPassword123
 *
 * It will:
 *   1. Look up the user by email
 *   2. Hash the new password using the exact same hashPassword() function
 *      the app already uses (Argon2id + your configured pepper), so it
 *      works immediately with the normal login form
 *   3. Revoke all existing refresh tokens for that account (forces any
 *      other logged-in sessions to re-authenticate)
 *   4. Log the action via the app's own logger()
 *
 * Delete this file (or just don't worry about it — it does nothing unless
 * someone runs it FROM YOUR SERVER'S TERMINAL, which the public can't do)
 * once you're done, just for tidiness.
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo "This script can only be run from the command line.\n";
    exit(1);
}

$email       = $argv[1] ?? null;
$newPassword = $argv[2] ?? null;

if (!$email || !$newPassword) {
    echo "Usage: php reset_password_cli.php <email> <new_password>\n";
    exit(1);
}

if (strlen($newPassword) < 8) {
    echo "Error: new password must be at least 8 characters.\n";
    exit(1);
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/security.php';

try {
    $stmt = $pdo->prepare("SELECT id, name, role FROM users WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        echo "Error: no user found with email: {$email}\n";
        exit(1);
    }

    $newHash = hashPassword($newPassword);

    $upd = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
    $upd->execute([$newHash, $user['id']]);

    if (function_exists('revokeAllUserRefreshTokens')) {
        revokeAllUserRefreshTokens($pdo, (int)$user['id']);
    }

    if (function_exists('logger')) {
        logger('info', 'AUTH', "Password reset via CLI script for user #{$user['id']} ({$email}).");
    }

    echo "Success: password reset for {$user['name']} ({$email}, role: {$user['role']}).\n";
    echo "You can log in now with the new password.\n";
} catch (Exception $e) {
    echo "Error: reset failed — " . $e->getMessage() . "\n";
    exit(1);
}