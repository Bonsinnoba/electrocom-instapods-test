<?php
require_once 'config.php';
require_once __DIR__ . '/vendor/autoload.php';

use Dotenv\Dotenv;

// Load environment variables
try {
    $dotenv = Dotenv::createImmutable(__DIR__);
    $dotenv->load();
} catch (Exception $e) {
    // .env might not exist in production
}

// Connect to database directly
try {
    $pdo = new PDO(
        "mysql:host=" . ($_ENV['DB_HOST'] ?? 'localhost') . ";dbname=" . ($_ENV['DB_NAME'] ?? ''),
        $_ENV['DB_USER'] ?? '',
        $_ENV['DB_PASS'] ?? '',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}

header('Content-Type: text/plain');

echo "--- STARTING MIGRATION: REMOVE TECHNICAL SETTINGS ---\n";

try {
    // Remove identity settings
    echo "Removing identity settings from database...\n";
    $stmt = $pdo->prepare("DELETE FROM site_settings WHERE setting_key IN (
        'siteName', 'siteEmail', 'phone1', 'phone2', 'whatsapp'
    )");
    $stmt->execute();
    $count = $stmt->rowCount();
    echo "Removed $count identity setting(s).\n";

    // Remove asset settings
    echo "Removing asset settings from database...\n";
    $stmt = $pdo->prepare("DELETE FROM site_settings WHERE setting_key IN (
        'siteLogoUrl', 'faviconUrl'
    )");
    $stmt->execute();
    $count = $stmt->rowCount();
    echo "Removed $count asset setting(s).\n";

    // Remove email provider settings
    echo "Removing email provider settings from database...\n";
    $stmt = $pdo->prepare("DELETE FROM site_settings WHERE setting_key IN (
        'emailProvider', 'emailProviderSmtpEnabled', 'emailProviderMailgunEnabled', 'emailProviderSendgridEnabled'
    )");
    $stmt->execute();
    $count = $stmt->rowCount();
    echo "Removed $count email provider setting(s).\n";

    // Remove hover color settings
    echo "Removing hover color settings from database...\n";
    $stmt = $pdo->prepare("DELETE FROM site_settings WHERE setting_key IN (
        'buttonPrimaryHover', 'buttonSecondaryHover', 'buttonAccentHover', 'linkHover', 'cardHover'
    )");
    $stmt->execute();
    $count = $stmt->rowCount();
    echo "Removed $count hover color setting(s).\n";

    echo "\n--- MIGRATION COMPLETE ---\n";
    echo "Note: These settings are now in .env or calculated in code.\n";
} catch (Exception $e) {
    echo "MIGRATION FAILED: " . $e->getMessage() . "\n";
}
