<?php

/**
 * super_dashboard.php
 * Real aggregate stats for the Super User Dashboard.
 *
 * GET → returns: total_revenue, total_orders, total_users,
 *                total_admins, total_products, recent_orders,
 *                orders_by_status,
 *                server_health, auth_origins, error_log_tail
 */

require 'cors_middleware.php';
require 'db.php';
require 'security.php';
require_once __DIR__ . '/auth_login_log.php';
header('Content-Type: application/json');

try {
    $userId = requireRole('super', $pdo);

    // ── Revenue & Orders ─────────────────────────────────────────────────────
    $revenueRow = $pdo->query("
        SELECT
            COALESCE(SUM(total_amount), 0)  AS total_revenue,
            COUNT(*)                         AS total_orders,
            SUM(CASE WHEN status='pending'   THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status='processing'THEN 1 ELSE 0 END) AS processing,
            SUM(CASE WHEN status='shipped'   THEN 1 ELSE 0 END) AS shipped,
            SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
            SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled
        FROM orders
    ")->fetch();

    // ── Users ────────────────────────────────────────────────────────────────
    $userRow = $pdo->query("
        SELECT
            COUNT(*) AS total_users,
            SUM(CASE WHEN role='store_manager' THEN 1 ELSE 0 END) AS total_admins
        FROM users
    ")->fetch();

    // ── Products ─────────────────────────────────────────────────────────────
    $productRow = $pdo->query("SELECT COUNT(*) AS total_products FROM products")->fetch();

    // ── Visitor Statistics ────────────────────────────────────────────────────
    $visitorStats = [];
    $visitorGrowthChart = [];
    try {
        // Get total unique visitors
        $totalVisitors = $pdo->query("SELECT COUNT(*) as total FROM site_analytics")->fetch(PDO::FETCH_ASSOC)['total'];

        // Get total registered visitors (users with accounts who have visited)
        $totalRegisteredVisitors = $pdo->query("SELECT COUNT(*) as total FROM site_analytics WHERE is_registered = 1")->fetch(PDO::FETCH_ASSOC)['total'];

        $visitorStats = [
            'total_unique_visitors' => (int)$totalVisitors,
            'total_registered_visitors' => (int)$totalRegisteredVisitors
        ];

        // Get visitor growth data for the last 30 days
        $visitorGrowthChart = $pdo->query("
            SELECT date, unique_visitors, registered_visitors, total_visits, new_visitors
            FROM site_analytics_history
            WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            ORDER BY date ASC
        ")->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        // Table might not exist yet, default to 0
        $visitorStats = [
            'total_unique_visitors' => 0,
            'total_registered_visitors' => 0
        ];
        $visitorGrowthChart = [];
    }

    // ── Recent Orders (last 5) ────────────────────────────────────────────────
    $recent = $pdo->query("
        SELECT o.id, o.total_amount, o.status, o.created_at,
               u.name AS customer, u.email
        FROM orders o
        JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
        LIMIT 5
    ")->fetchAll();



    // ── Auth origins: successful sign-ins by provider (last 30 days), incl. GitHub OAuth
    $authOrigins = [];
    $authLogTotal = 0;
    try {
        ensureAuthLoginLogTable($pdo);
        $authOrigins = $pdo->query("
            SELECT provider, COUNT(*) AS count
            FROM auth_login_log
            WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
            GROUP BY provider
            ORDER BY count DESC
        ")->fetchAll();
        $authLogTotal = (int) array_sum(array_map(static function ($r) {
            return (int) ($r['count'] ?? 0);
        }, $authOrigins));
    } catch (Throwable $e) {
        error_log('super_dashboard auth_login_log: ' . $e->getMessage());
    }
    if ($authLogTotal === 0) {
        $authOrigins = $pdo->query("
            SELECT
                COALESCE(NULLIF(auth_provider, ''), 'local') AS provider,
                COUNT(*) AS count
            FROM users
            GROUP BY provider
            ORDER BY count DESC
        ")->fetchAll();
    }

    // ── Server Health ─────────────────────────────────────────────────────────
    $diskTotal  = @disk_total_space(__DIR__) ?: 0;
    $diskFree   = @disk_free_space(__DIR__)  ?: 0;
    $diskUsed   = $diskTotal - $diskFree;
    $diskUsedPct = $diskTotal > 0 ? round(($diskUsed / $diskTotal) * 100) : 0;

    $memUsed    = memory_get_usage(true);
    $memPeak    = memory_get_peak_usage(true);
    $memLimit   = ini_get('memory_limit');

    // DB table sizes
    $dbName   = $pdo->query("SELECT DATABASE()")->fetchColumn();
    $dbTables = $pdo->query("
        SELECT table_name AS name,
               ROUND((data_length + index_length) / 1024, 1) AS size_kb,
               table_rows AS approx_rows
        FROM information_schema.tables
        WHERE table_schema = '$dbName'
        ORDER BY (data_length + index_length) DESC
        LIMIT 8
    ")->fetchAll();

    // ── PHP Error Log Tail (last 40 lines) ────────────────────────────────────
    $errorLogPath = ini_get('error_log');
    $errorLogLines = [];
    if ($errorLogPath && file_exists($errorLogPath) && is_readable($errorLogPath)) {
        $lines = @file($errorLogPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        $errorLogLines = array_slice($lines, -40);
    }

    // ── Compose response ──────────────────────────────────────────────────────
    echo json_encode([
        'success'        => true,
        'total_revenue'  => (float)$revenueRow['total_revenue'],
        'total_orders'   => (int)$revenueRow['total_orders'],
        'pending_orders' => (int)$revenueRow['pending'],
        'total_users'    => (int)$userRow['total_users'],
        'total_admins'   => (int)$userRow['total_admins'],
        'total_products' => (int)$productRow['total_products'],
        'orders_by_status' => [
            'pending'    => (int)($revenueRow['pending'] ?? 0),
            'processing' => (int)($revenueRow['processing'] ?? 0),
            'shipped'    => (int)($revenueRow['shipped'] ?? 0),
            'delivered'  => (int)($revenueRow['delivered'] ?? 0),
            'cancelled'  => (int)($revenueRow['cancelled'] ?? 0),
        ],
        'recent_orders'  => $recent,

        'visitor_stats'  => $visitorStats,
        'visitor_growth_chart' => $visitorGrowthChart,

        'auth_origins'   => $authOrigins,
        'auth_origins_window_days' => $authLogTotal > 0 ? 30 : null,
        'server_health'  => [
            'disk_total_gb'  => round($diskTotal / 1073741824, 1),
            'disk_used_gb'   => round($diskUsed  / 1073741824, 1),
            'disk_free_gb'   => round($diskFree  / 1073741824, 1),
            'disk_used_pct'  => $diskUsedPct,
            'mem_used_mb'    => round($memUsed / 1048576, 1),
            'mem_peak_mb'    => round($memPeak / 1048576, 1),
            'mem_limit'      => $memLimit,
            'php_version'    => PHP_VERSION,
            'db_tables'      => $dbTables,
        ],
        'error_log_tail' => $errorLogLines,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
