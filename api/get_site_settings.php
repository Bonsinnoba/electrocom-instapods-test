<?php
/**
 * get_site_settings.php
 * Public storefront endpoint — returns branding and operational settings safe for exposure.
 * No authentication required. Exempt from maintenance-mode blocking (see security.php).
 */

require_once 'cors_middleware.php';
require_once __DIR__ . '/db.php';           // Establishes $pdo; runs rate-limit & maintenance checks
require_once __DIR__ . '/brand_settings.php'; // Merge helpers (already safe after db.php loaded)

header('Content-Type: application/json');

// Use always-load settings for storefront (WordPress alloptions style)
// These are cached with longer TTL (30 minutes) since they're used on every page load
$alwaysLoadSettings = eh_get_always_load_settings();
$publicKeys = eh_storefront_public_setting_keys();

// Only expose whitelisted keys to the storefront.
$publicSettings = array_intersect_key($alwaysLoadSettings, array_flip($publicKeys));

// Ensure boolean values are correct types (DB stores '1'/'0' strings).
$boolKeys = ['maintenanceMode', 'allowRegistration', 'allowDoorToDoorDelivery', 'allowCardPayment'];
foreach ($boolKeys as $k) {
    if (isset($publicSettings[$k])) {
        $publicSettings[$k] = filter_var($publicSettings[$k], FILTER_VALIDATE_BOOLEAN);
    }
}

// Ensure numeric values are correct types.
$numKeys = ['vatRate', 'doorToDoorThreshold', 'defaultItemsPerPage',
            'integrityDiscountThreshold', 'integrityDiscountPct'];
foreach ($numKeys as $k) {
    if (isset($publicSettings[$k])) {
        $publicSettings[$k] = is_float($publicSettings[$k] + 0)
            ? (float) $publicSettings[$k]
            : (int) $publicSettings[$k];
    }
}

echo json_encode(['success' => true, 'data' => $publicSettings]);
