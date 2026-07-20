<?php
// Test script to debug super_settings.php save issue

require '../api/db.php';
require '../api/cors_middleware.php';
require '../api/security.php';
require_once '../api/cache.php';
require_once '../api/brand_settings.php';

// Simulate a super user authentication
$userId = 1; // Assuming user ID 1 is a super user
$role = 'super';

$settingsFile = __DIR__ . '/../api/data/super_settings.json';

$testPayload = [
    'primaryColor' => '#ff0000',
    'siteName' => 'Test Store'
];

$DEFAULTS = eh_super_settings_defaults_full();
$CRITICAL_KEYS = eh_critical_db_settings_keys();

// Separate critical and non-critical settings
$criticalSettings = array_intersect_key($testPayload, array_flip($CRITICAL_KEYS));
$brandingSettings = array_diff_key($testPayload, array_flip($CRITICAL_KEYS));

// Only persist known keys
$safeCritical = array_intersect_key($criticalSettings, $DEFAULTS);
$safeBranding = array_intersect_key($brandingSettings, $DEFAULTS);

echo "Critical settings to save: " . json_encode($safeCritical) . "\n";
echo "Branding settings to save: " . json_encode($safeBranding) . "\n";

// Test database save
if (!empty($safeCritical)) {
    echo "\nTesting database save...\n";
    try {
        global $pdo;
        $pdo->beginTransaction();

        foreach ($safeCritical as $key => $value) {
            $valueType = 'string';
            if (is_bool($value)) {
                $valueType = 'boolean';
                $value = $value ? 'true' : 'false';
            } elseif (is_int($value)) {
                $valueType = 'integer';
            } elseif (is_float($value)) {
                $valueType = 'float';
            }

            $category = 'operational';
            if (in_array($key, ['maxLoginAttempts', 'sessionTimeout', 'twoFactorAdmin', 'lockoutDuration',
                              'passwordMinLength', 'requireEmailVerification', 'requireNumberInPassword',
                              'apiRateLimit', 'emailNotify', 'securityAlerts', 'debugMode'])) {
                $category = 'security';
            } elseif (in_array($key, ['vatRate', 'allowRegistration', 'allowCardPayment', 'lowStockThreshold',
                                    'lowStockAlertEmail', 'integrityDiscountThreshold', 'integrityDiscountPct'])) {
                $category = 'business';
            } elseif (in_array($key, ['allowDoorToDoorDelivery', 'doorToDoorThreshold'])) {
                $category = 'delivery';
            }

            $isPublic = in_array($key, ['vatRate', 'allowRegistration', 'allowCardPayment',
                                       'allowDoorToDoorDelivery', 'doorToDoorThreshold',
                                       'integrityDiscountThreshold', 'integrityDiscountPct',
                                       'defaultItemsPerPage', 'homepageSectionTitle',
                                       'homepageFeaturedCategory', 'orderReceiptFooterNote']);

            $stmt = $pdo->prepare("
                INSERT INTO site_settings (setting_key, setting_value, value_type, category, is_public)
                VALUES (:key, :value, :type, :category, :is_public)
                ON DUPLICATE KEY UPDATE
                    setting_value = :value,
                    value_type = :type,
                    category = :category,
                    is_public = :is_public,
                    updated_at = CURRENT_TIMESTAMP
            ");
            $stmt->execute([
                ':key' => $key,
                ':value' => is_string($value) ? $value : json_encode($value),
                ':type' => $valueType,
                ':category' => $category,
                ':is_public' => $isPublic
            ]);

            echo "Saved to DB: $key = $value\n";
        }

        $pdo->commit();
        echo "Database save successful\n";
    } catch (Exception $e) {
        $pdo->rollBack();
        echo "Database error: " . $e->getMessage() . "\n";
        echo "Stack trace: " . $e->getTraceAsString() . "\n";
    }
}

// Test JSON file save
if (!empty($safeBranding)) {
    echo "\nTesting JSON file save...\n";
    echo "Settings file path: " . $settingsFile . "\n";
    echo "Directory exists: " . (is_dir(dirname($settingsFile)) ? 'yes' : 'no') . "\n";
    echo "Directory writable: " . (is_writable(dirname($settingsFile)) ? 'yes' : 'no') . "\n";
    
    try {
        $existing = file_exists($settingsFile) ? (json_decode(file_get_contents($settingsFile), true) ?? []) : [];
        $mergedBranding = array_merge($existing, $safeBranding);
        $jsonOutput = json_encode($mergedBranding, JSON_PRETTY_PRINT);
        
        echo "JSON output length: " . strlen($jsonOutput) . "\n";
        
        $writeResult = file_put_contents($settingsFile, $jsonOutput);
        if ($writeResult === false) {
            echo "Failed to write to settings file\n";
            echo "Last PHP error: " . (error_get_last()['message'] ?? 'unknown') . "\n";
        } else {
            echo "Successfully wrote $writeResult bytes to settings file\n";
        }
    } catch (Exception $e) {
        echo "File write error: " . $e->getMessage() . "\n";
        echo "Stack trace: " . $e->getTraceAsString() . "\n";
    }
}

echo "\nTest complete\n";
