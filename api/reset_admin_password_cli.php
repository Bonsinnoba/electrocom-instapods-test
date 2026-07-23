<?php
/**
 * One-time CLI recovery utility for an admin account.
 * Run on the server, then delete this file after use.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit("CLI only.\n");
}

$email = trim($argv[1] ?? '');
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Usage: php api/reset_admin_password_cli.php admin@example.com\n");
    exit(2);
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/security.php';

function readHiddenInput(string $prompt): string
{
    fwrite(STDOUT, $prompt);
    if (DIRECTORY_SEPARATOR === '/') {
        system('stty -echo');
    }
    $value = trim((string)fgets(STDIN));
    if (DIRECTORY_SEPARATOR === '/') {
        system('stty echo');
    }
    fwrite(STDOUT, PHP_EOL);
    return $value;
}

$password = readHiddenInput('New password (minimum 8 characters): ');
$confirmation = readHiddenInput('Confirm new password: ');

if (strlen($password) < 8 || $password !== $confirmation) {
    fwrite(STDERR, "Passwords must match and be at least 8 characters long.\n");
    exit(2);
}

$stmt = $pdo->prepare("SELECT id, email, role, status, deleted_at FROM users WHERE email = ? LIMIT 1");
$stmt->execute([$email]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    fwrite(STDERR, "No account found for that email.\n");
    exit(1);
}

if (!in_array($user['role'], ['super', 'store_manager', 'accountant', 'marketing', 'picker'], true)) {
    fwrite(STDERR, "The account does not have an admin role.\n");
    exit(1);
}

if (($user['status'] ?? '') === 'Suspended' || $user['deleted_at'] !== null) {
    fwrite(STDERR, "The account is suspended or scheduled for deletion; no change was made.\n");
    exit(1);
}

$newHash = hashPassword($password);
$update = $pdo->prepare("UPDATE users SET password_hash = ?, login_attempts = 0, lockout_until = NULL, is_verified = 1, verification_code = NULL WHERE id = ?");
$update->execute([$newHash, $user['id']]);

fwrite(STDOUT, "Password reset for {$user['email']} ({$user['role']}).\n");
fwrite(STDOUT, "Delete api/reset_admin_password_cli.php after use.\n");
