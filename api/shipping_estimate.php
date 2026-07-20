<?php
// api/shipping_estimate.php
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

/**
 * Shipping Estimate Endpoint
 * Parameters:
 *  - region: The target shipping region (e.g., 'Ashanti', 'Greater Accra', 'WA-')
 *  - subtotal: The current cart value to check for 50% discount eligibility
 */

$regionInput = sanitizeInput($_GET['region'] ?? 'Greater Accra');
$subtotal = (float)($_GET['subtotal'] ?? 0);

// Map common ZIP prefixes to regions if needed (for more intelligent routing)
$GHANA_REGIONS_MAP = [
    'GA-' => 'Greater Accra',
    'AK-' => 'Ashanti',
    'CR-' => 'Central',
    'WR-' => 'Western',
    'ER-' => 'Eastern',
    'VR-' => 'Volta',
    'NR-' => 'Northern',
    'UE-' => 'Upper East',
    'UW-' => 'Upper West',
    'BA-' => 'Brong Ahafo',
    'WN-' => 'Western North',
    'AH-' => 'Ahafo',
    'BE-' => 'Bono East',
    'OR-' => 'Oti',
    'NE-' => 'North East',
    'SR-' => 'Savannah'
];

$normalizedRegion = $regionInput;
foreach ($GHANA_REGIONS_MAP as $prefix => $fullName) {
    if (stripos($regionInput, $prefix) === 0 || stripos($regionInput, $fullName) !== false) {
        $normalizedRegion = $fullName;
        break;
    }
}

try {
    // 2. Calculate dynamic fee based on region and subtotal
    $shippingInfo = calculateRegionalShipping($normalizedRegion, $subtotal, $pdo);

    sendResponse(true, 'Shipping estimate calculated', [
        'region_detected' => $normalizedRegion,
        'fee' => $shippingInfo['fee'],
        'city' => $shippingInfo['city'],
        'is_discounted' => ($subtotal >= 1500),
        'discount_threshold' => 1500
    ]);
} catch (Exception $e) {
    sendResponse(false, 'Estimation failed: ' . $e->getMessage(), null, 500);
}
