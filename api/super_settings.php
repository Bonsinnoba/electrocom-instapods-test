<?php

/**
 * super_settings.php
 * Global settings store for the Super User panel.
 * All settings are stored in database with caching (WordPress alloptions style).
 *
 * GET  → returns current settings from database (with cache)
 * POST → saves updated settings to database (invalidates cache)
 */

require 'cors_middleware.php';
require 'db.php';
require 'security.php';
require_once __DIR__ . '/cache.php';
require_once __DIR__ . '/brand_settings.php';
header('Content-Type: application/json');

// Authenticate and Require Roles
try {
    error_log('POST super_settings: Starting authentication');
    $userId = authenticate($pdo);
    error_log('POST super_settings: User authenticated: ' . $userId);
    $role = getUserRole($userId, $pdo);
    error_log('POST super_settings: User role: ' . $role);

    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'GET') {
        // All admins can read settings (e.g. for maintenance check)
        requireRole(RBAC_ALL_ADMINS, $pdo);
    } else {
        // Only super can modify
        error_log('POST super_settings: Requiring super role');
        requireRole('super', $pdo);
        error_log('POST super_settings: Super role confirmed');
    }
} catch (Exception $e) {
    error_log('POST super_settings: Authentication error: ' . $e->getMessage());
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
}

$settingsFile = eh_super_settings_path();
$CRITICAL_KEYS = eh_critical_db_settings_keys();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Return merged settings from database with cache
    $merged = eh_merged_super_settings();
    echo json_encode(['success' => true, 'data' => $merged]);
} elseif ($method === 'POST') {
    error_log('POST super_settings: Starting request processing');
    
    $rawInput = file_get_contents('php://input');
    if ($rawInput === false) {
        error_log('POST super_settings: Failed to read request body');
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Failed to read request body.']);
        exit;
    }
    
    error_log('POST super_settings: Raw input length: ' . strlen($rawInput));
    
    $body = json_decode($rawInput, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log('POST super_settings: JSON decode error: ' . json_last_error_msg());
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON payload: ' . json_last_error_msg()]);
        exit;
    }
    
    if (!is_array($body)) {
        error_log('POST super_settings: Body is not an array');
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON payload.']);
        exit;
    }
    
    error_log('POST super_settings: Body keys: ' . implode(', ', array_keys($body)));

    // Allow all settings keys to be saved (no validation against defaults)
    $safeSettings = $body;

    error_log('POST super_settings: Safe settings keys: ' . implode(', ', array_keys($safeSettings)));

    $changedKeys = [];

    // Save all settings to database
    if (!empty($safeSettings)) {
        error_log('POST super_settings: Starting database transaction for ' . count($safeSettings) . ' settings');
        try {
            $pdo->beginTransaction();

            foreach ($safeSettings as $key => $value) {
                // Determine value type
                $valueType = 'string';
                if (is_bool($value)) {
                    $valueType = 'boolean';
                    $value = $value ? 'true' : 'false';
                } elseif (is_int($value)) {
                    $valueType = 'integer';
                } elseif (is_float($value)) {
                    $valueType = 'float';
                }

                // Determine category
                $category = 'operational';
                if (in_array($key, ['maxLoginAttempts', 'sessionTimeout', 'twoFactorAdmin', 'lockoutDuration',
                                  'passwordMinLength', 'requireEmailVerification', 'requireNumberInPassword',
                                  'apiRateLimit', 'emailNotify', 'securityAlerts', 'debugMode'])) {
                    $category = 'security';
                } elseif (in_array($key, ['siteTagline', 'metaDescription', 'storeAddress', 'businessHours', 'socialInstagram',
                                        'socialTwitter', 'socialFacebook', 'socialTikTok', 'socialYoutube'])) {
                    $category = 'identity';
                } elseif (in_array($key, ['primaryColor', 'accentColor', 'headerBg',
                                        'fontFamily', 'selectedTheme'])) {
                    $category = 'branding';
                } elseif (in_array($key, ['heroBannerTagline', 'heroBannerSubtext', 'heroCTAText', 'heroCTAUrl'])) {
                    $category = 'content';
                } elseif (in_array($key, ['vatRate', 'allowRegistration', 'allowCardPayment', 'lowStockThreshold',
                                        'lowStockAlertEmail', 'integrityDiscountThreshold', 'integrityDiscountPct'])) {
                    $category = 'business';
                } elseif (in_array($key, ['allowDoorToDoorDelivery', 'doorToDoorThreshold'])) {
                    $category = 'delivery';
                } elseif (in_array($key, ['insightsShipWarnHours', 'insightsShipCriticalHours', 'insightsLowStockWarnCount',
                                        'insightsLowStockCriticalCount', 'insightsOnlineRevenueMinPct', 'insightsRepeatOrderMin',
                                        'insightsWeightShip', 'insightsWeightStock', 'insightsWeightOnline', 'insightsWeightRepeat'])) {
                    $category = 'insights';
                } elseif (in_array($key, ['maintenanceMode'])) {
                    $category = 'availability';
                }

                // Determine if public (accessible by storefront)
                $publicKeys = array_merge(
                    eh_always_load_settings_keys(),
                    eh_occasional_settings_keys()
                );
                $isPublic = in_array($key, $publicKeys) ? 1 : 0;

                // Upsert into database
                $stmt = $pdo->prepare("
                    INSERT INTO site_settings (setting_key, setting_value, value_type, category, is_public)
                    VALUES (:key, :value, :type, :category, :is_public)
                    ON DUPLICATE KEY UPDATE
                        setting_value = VALUES(setting_value),
                        value_type = VALUES(value_type),
                        category = VALUES(category),
                        is_public = VALUES(is_public),
                        updated_at = CURRENT_TIMESTAMP
                ");
                $stmt->execute([
                    ':key' => $key,
                    ':value' => is_string($value) ? $value : json_encode($value),
                    ':type' => $valueType,
                    ':category' => $category,
                    ':is_public' => $isPublic
                ]);

                $changedKeys[] = $key;
            }

            $pdo->commit();
            error_log('POST super_settings: Database transaction committed successfully');
        } catch (Exception $e) {
            error_log('POST super_settings: Database error: ' . $e->getMessage());
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to save settings: ' . $e->getMessage()]);
            exit;
        }
    }

    // Log audit with error handling
    try {
        logAdminAudit($pdo, $userId, 'settings.update', 'super_settings', 'global', [
            'changed_keys' => $changedKeys
        ]);
    } catch (Exception $e) {
        error_log('Audit log error: ' . $e->getMessage());
    }

    // Invalidate all settings cache groups
    try {
        eh_cache_delete('db_settings', 'settings');
        eh_cache_delete('merged_settings', 'settings');
        eh_cache_delete('always_load_settings', 'settings_always');
        eh_cache_delete('occasional_settings', 'settings_occasional');
        eh_cache_delete('homepage_boot', 'homepage');
    } catch (Exception $e) {
        error_log('Cache invalidation error: ' . $e->getMessage());
    }

    // Return merged settings (force refresh to bypass cache)
    try {
        $merged = eh_merged_super_settings(true);
    } catch (Exception $e) {
        error_log('Error fetching merged settings: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to fetch merged settings: ' . $e->getMessage()]);
        exit;
    }
    echo json_encode(['success' => true, 'message' => 'Settings saved.', 'data' => $merged]);
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
}
