<?php
// api/data_pruning_config.php
// Data pruning and archiving configuration

return [
    // Enable/disable data pruning
    'enabled' => true,

    // Retention periods (in days)
    'retention' => [
        'shopping_carts' => 30,          // Delete abandoned carts after 30 days
        'sessions' => 7,                   // Delete sessions after 7 days
        'system_logs' => 90,               // Archive logs after 90 days
        'user_activity' => 365,           // Archive user activity after 1 year
        'orders' => 730,                  // Archive orders after 2 years
        'product_reviews' => 730,         // Archive reviews after 2 years
        'coupons' => 30,                  // Archive expired coupons after 30 days
        'notifications' => 30,             // Delete read notifications after 30 days
    ],

    // Archive settings
    'archive' => [
        'enabled' => true,
        'compress' => true,                // Compress archived data
        'location' => __DIR__ . '/archives', // Archive storage location
    ],

    // Pruning schedule
    'schedule' => [
        'daily' => [
            'shopping_carts',
            'sessions',
            'notifications',
        ],
        'weekly' => [
            'system_logs',
            'user_activity',
            'coupons',
        ],
        'monthly' => [
            'orders',
            'product_reviews',
        ],
    ],

    // Data to never prune (whitelist)
    'never_prune' => [
        'users',                          // Never delete user accounts
        'products',                       // Never delete products
        'categories',                     // Never delete categories
        'settings',                       // Never delete settings
        'migrations',                     // Never delete migration records
    ],

    // Safety limits
    'safety' => [
        'max_records_per_run' => 10000,   // Maximum records to process per run
        'dry_run' => false,                // Set to true to test without actually deleting
        'require_confirmation' => true,    // Require confirmation for destructive operations
    ],

    // Monitoring
    'monitoring' => [
        'log_operations' => true,
        'alert_on_failure' => true,
        'alert_on_large_deletions' => true, // Alert if deleting >1000 records
    ],
];
