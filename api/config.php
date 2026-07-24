<?php
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
/**
 * Configuration Loader
 * Loads environment variables from .env using phpdotenv and 
 * provides a unified $config array for backward compatibility.
 */

require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;

// Initialize Dotenv
// In production, environment variables are set on the pod and should take precedence.
// Select the matching file when deployment variables are not available.
$runtimeEnv = $_ENV['APP_ENV'] ?? $_SERVER['APP_ENV'] ?? getenv('APP_ENV') ?: '';
$dbHost = $_ENV['DB_HOST'] ?? $_SERVER['DB_HOST'] ?? getenv('DB_HOST') ?: '';
$dbPass = $_ENV['DB_PASS'] ?? $_SERVER['DB_PASS'] ?? getenv('DB_PASS') ?: '';

// Keep process-level deployment variables available to the existing config map.
foreach (['APP_ENV', 'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME', 'DB_SSL', 'DB_AUTO_REPAIR'] as $key) {
    if (array_key_exists($key, $_ENV)) {
        continue;
    }

    $value = $_SERVER[$key] ?? getenv($key);
    if ($value !== false && $value !== null) {
        $_ENV[$key] = $value;
    }
}

// Debug: Show initial $_ENV state
error_log("=== Config Debug ===");
error_log("Initial DB_HOST from \$_ENV: " . ($dbHost ?: 'empty'));
error_log("Initial DB_PASS from \$_ENV: " . ($dbPass ? 'length=' . strlen($dbPass) : 'empty'));

if (empty($dbHost) || empty($dbPass) || $dbHost === 'localhost') {
    error_log("Loading from dotenv files...");
    $envFiles = strtolower((string)$runtimeEnv) === 'production'
        ? ['.env.production', '.env']
        : ['.env', '.env.production'];

    foreach ($envFiles as $envFile) {
        if (!is_file(__DIR__ . '/' . $envFile)) {
            continue;
        }

        try {
            $dotenv = Dotenv::createImmutable(__DIR__, $envFile);
            $dotenv->load();
            error_log("Loaded from $envFile");
            break;
        } catch (Exception $e) {
            error_log("Unable to load $envFile");
        }
    }
} else {
    error_log("Using pod environment variables (skipping dotenv)");
}

// Never prepend PHP warnings/notices to JSON responses in production.
if (strtolower((string)($_ENV['APP_ENV'] ?? $runtimeEnv)) === 'production') {
    ini_set('display_errors', 0);
    ini_set('display_startup_errors', 0);
}

// Debug: Show final values
error_log("Final DB_HOST: " . ($_ENV['DB_HOST'] ?? 'empty'));
error_log("Final DB_PASS: " . (isset($_ENV['DB_PASS']) ? 'length=' . strlen($_ENV['DB_PASS']) : 'empty'));

// Map environment variables to the $config array
$config = [
    'APP_ENV'             => $_ENV['APP_ENV'] ?? 'production',
    'APP_URL'             => $_ENV['APP_URL'] ?? '',
    'FRONTEND_URL'        => $_ENV['FRONTEND_URL'] ?? '',
    
    // Site Identity
    'SITE_NAME'           => $_ENV['SITE_NAME'] ?? 'My Store',
    'SITE_EMAIL'          => $_ENV['SITE_EMAIL'] ?? 'hello@example.com',
    'PHONE1'              => $_ENV['PHONE1'] ?? '',
    'PHONE2'              => $_ENV['PHONE2'] ?? '',
    'WHATSAPP'            => $_ENV['WHATSAPP'] ?? '',
    
    // Site Assets
    'SITE_LOGO_URL'       => $_ENV['SITE_LOGO_URL'] ?? '',
    'FAVICON_URL'         => $_ENV['FAVICON_URL'] ?? '',
    
    // Database - Aiven MySQL defaults for production
    'DB_HOST'             => $_ENV['DB_HOST'] ?? 'electrocom-test-db-ivenbalika123-0bee.h.aivencloud.com',
    'DB_PORT'             => $_ENV['DB_PORT'] ?? 16052,
    'DB_USER'             => $_ENV['DB_USER'] ?? 'avnadmin',
    'DB_PASS'             => $_ENV['DB_PASS'] ?? '',
    'DB_NAME'             => $_ENV['DB_NAME'] ?? 'defaultdb',
    'DB_SSL'              => filter_var($_ENV['DB_SSL'] ?? true, FILTER_VALIDATE_BOOLEAN),
    'DB_AUTO_REPAIR'      => filter_var($_ENV['DB_AUTO_REPAIR'] ?? false, FILTER_VALIDATE_BOOLEAN),
    
    // Security & Encryption
    'JWT_SECRET'          => $_ENV['JWT_SECRET'] ?? '',
    'PASSWORD_PEPPER'     => $_ENV['PASSWORD_PEPPER'] ?? '',
    'DATA_ENCRYPTION_KEY' => $_ENV['DATA_ENCRYPTION_KEY'] ?? '',
    
    // Payment: Paystack
    'PAYSTACK_SECRET'     => $_ENV['PAYSTACK_SECRET'] ?? '',
    
    // Social Login: Google
    'GOOGLE_CLIENT_ID'     => $_ENV['GOOGLE_CLIENT_ID'] ?? '',
    'GOOGLE_CLIENT_SECRET' => $_ENV['GOOGLE_CLIENT_SECRET'] ?? '',
    'GOOGLE_REDIRECT'      => $_ENV['GOOGLE_REDIRECT'] ?? '',
    
    // Social Login: Github
    'GITHUB_CLIENT_ID'     => $_ENV['GITHUB_CLIENT_ID'] ?? '',
    'GITHUB_CLIENT_SECRET' => $_ENV['GITHUB_CLIENT_SECRET'] ?? '',
    'GITHUB_REDIRECT'      => $_ENV['GITHUB_REDIRECT'] ?? '',
    
    // Notification: Email
    'EMAIL_PROVIDER'    => $_ENV['EMAIL_PROVIDER'] ?? 'smtp',
    'EMAIL_QUEUE_ENABLED' => filter_var($_ENV['EMAIL_QUEUE_ENABLED'] ?? true, FILTER_VALIDATE_BOOLEAN),
    'EMAIL_MAX_ATTEMPTS'  => (int)($_ENV['EMAIL_MAX_ATTEMPTS'] ?? 5),
    'EMAIL_SMTP_ENABLED'    => filter_var($_ENV['EMAIL_SMTP_ENABLED'] ?? true, FILTER_VALIDATE_BOOLEAN),
    'EMAIL_MAILGUN_ENABLED' => filter_var($_ENV['EMAIL_MAILGUN_ENABLED'] ?? false, FILTER_VALIDATE_BOOLEAN),
    'EMAIL_SENDGRID_ENABLED'=> filter_var($_ENV['EMAIL_SENDGRID_ENABLED'] ?? false, FILTER_VALIDATE_BOOLEAN),
    'MAIL_FROM_NAME'      => $_ENV['MAIL_FROM_NAME'] ?? 'ElectrCom',
    'MAIL_FROM'       => $_ENV['MAIL_FROM'] ?? '',
    'SMTP_HOST'       => $_ENV['SMTP_HOST'] ?? '',
    'SMTP_PORT'       => (int)($_ENV['SMTP_PORT'] ?? 587),
    'SMTP_USER'       => $_ENV['SMTP_USER'] ?? '',
    'SMTP_PASS'       => $_ENV['SMTP_PASS'] ?? '',
    'SMTP_ENCRYPTION' => $_ENV['SMTP_ENCRYPTION'] ?? 'tls',
    'MAILGUN_API_KEY' => $_ENV['MAILGUN_API_KEY'] ?? '',
    'MAILGUN_DOMAIN'  => $_ENV['MAILGUN_DOMAIN'] ?? '',
    'MAILGUN_REGION'  => $_ENV['MAILGUN_REGION'] ?? 'us',
    'SENDGRID_API_KEY' => $_ENV['SENDGRID_API_KEY'] ?? '',
    
    // Notification: SMS (Hubtel)
    'SMS_CLIENT_ID'     => $_ENV['SMS_CLIENT_ID'] ?? '',
    'SMS_CLIENT_SECRET' => $_ENV['SMS_CLIENT_SECRET'] ?? '',
    'SMS_FROM'          => $_ENV['SMS_FROM'] ?? '',
    'SMS_API_URL'       => $_ENV['SMS_API_URL'] ?? '',
    
    // Business Logic
    'ELITE_THRESHOLD' => (int)($_ENV['ELITE_THRESHOLD'] ?? 500),
    'VIP_THRESHOLD'   => (int)($_ENV['VIP_THRESHOLD'] ?? 2000),
    
    // Complex Types (Parsed from comma-separated strings with quotes stripped)
    'ALLOWED_ORIGINS'     => array_filter(array_map(function($val) { return trim($val, " \t\n\r\0\x0B\"'"); }, explode(',', $_ENV['ALLOWED_ORIGINS'] ?? ''))),
    'ALLOWED_IMAGE_BASES' => array_filter(array_map(function($val) { return trim($val, " \t\n\r\0\x0B\"'"); }, explode(',', $_ENV['ALLOWED_IMAGE_BASES'] ?? ''))),
];

// Provide global access if needed
$GLOBALS['config'] = $config;

return $config;
