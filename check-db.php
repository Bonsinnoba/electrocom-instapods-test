<?php
// Standalone .env parser test
$envFile = __DIR__ . '/.env';

if (!file_exists($envFile)) {
    die("Error: .env file not found in " . __DIR__ . "\n");
}

$lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$env = [];

foreach ($lines as $line) {
    if (strpos(trim($line), '#') === 0) continue; // Skip comments
    list($name, $value) = explode('=', $line, 2) + [NULL, NULL];
    if ($name && $value !== null) {
        $name = trim($name);
        $value = trim($value, " \t\n\r\0\x0B'\""); // Strip whitespace and quotes
        $env[$name] = $value;
    }
}

$pass = $env['DB_PASS'] ?? '';

echo "Loaded DB_PASS: " . $pass . "\n";
echo "Password Length: " . strlen($pass) . " characters\n";

if (strlen($pass) === 23 && strpos($pass, '$') !== false) {
    echo "WARNING: Your password contains a '$' and looks like it got truncated by phpdotenv!\n";
} elseif (strlen($pass) === 24) {
    echo "SUCCESS: Password loaded at full 24-character length!\n";
}