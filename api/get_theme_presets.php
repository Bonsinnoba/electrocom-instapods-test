<?php
/**
 * get_theme_presets.php
 * Returns available theme presets for the super admin to choose from
 */

header('Content-Type: application/json');
require_once __DIR__ . '/cors_middleware.php';
require_once __DIR__ . '/brand_settings.php';

try {
    $presets = eh_theme_presets();
    echo json_encode([
        'success' => true,
        'data' => $presets
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to load theme presets'
    ]);
}
