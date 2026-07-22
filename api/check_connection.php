<?php
/**
 * Safe production connectivity and CORS diagnostic.
 *
 * Run from the project root:
 *   php api/check_connection.php
 *   php api/check_connection.php --origin=https://your-frontend.example
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit("Run this diagnostic from the command line.\n");
}

require_once __DIR__ . '/config.php';

$options = getopt('', ['origin::']);
$origin = rtrim((string)($options['origin'] ?? ''), '/');
$allowedOrigins = $config['ALLOWED_ORIGINS'] ?? [];
$displayValue = static fn ($value): string => $value === '' ? '(empty)' : (string)$value;

$checks = [];
$checks['environment'] = [
    'value' => $displayValue($config['APP_ENV'] ?? ''),
    'ok' => true,
];
$checks['database_host'] = [
    'value' => $displayValue($config['DB_HOST'] ?? ''),
    'ok' => !empty($config['DB_HOST']),
];
$checks['database_port'] = [
    'value' => $displayValue($config['DB_PORT'] ?? ''),
    'ok' => !empty($config['DB_PORT']),
];
$checks['database_name'] = [
    'value' => $displayValue($config['DB_NAME'] ?? ''),
    'ok' => !empty($config['DB_NAME']),
];
$checks['database_user'] = [
    'value' => $displayValue($config['DB_USER'] ?? ''),
    'ok' => !empty($config['DB_USER']),
];
$checks['database_password'] = [
    'value' => !empty($config['DB_PASS']) ? 'set' : 'missing',
    'ok' => !empty($config['DB_PASS']),
];
$checks['database_ssl'] = [
    'value' => !empty($config['DB_SSL']) ? 'enabled' : 'disabled',
    'ok' => true,
];
$checks['pdo_mysql_extension'] = [
    'value' => extension_loaded('pdo_mysql') ? 'loaded' : 'missing',
    'ok' => extension_loaded('pdo_mysql'),
];
$checks['allowed_origins'] = [
    'value' => $allowedOrigins ? implode(', ', $allowedOrigins) : '(empty)',
    'ok' => !empty($allowedOrigins),
];

if ($origin !== '') {
    $checks['origin_match'] = [
        'value' => $origin,
        'ok' => in_array($origin, $allowedOrigins, true),
    ];
} else {
    $checks['origin_match'] = [
        'value' => 'not tested; pass --origin=...',
        'ok' => null,
    ];
}

if ($checks['pdo_mysql_extension']['ok'] && $checks['database_password']['ok']) {
    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        $config['DB_HOST'],
        $config['DB_PORT'] ?? 16052,
        $config['DB_NAME']
    );

    try {
        $pdoOptions = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        if (!empty($config['DB_SSL'])) {
            $pdoOptions[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
        }

        $pdo = new PDO($dsn, $config['DB_USER'], $config['DB_PASS'], $pdoOptions);
        $checks['pdo_connection'] = [
            'value' => 'connected',
            'ok' => true,
        ];
    } catch (Throwable $exception) {
        $checks['pdo_connection'] = [
            'value' => $exception->getMessage(),
            'ok' => false,
        ];
    }
} else {
    $checks['pdo_connection'] = [
        'value' => 'skipped; fix missing PDO MySQL extension or password first',
        'ok' => false,
    ];
}

$failed = false;
echo "ElectroCom connection diagnostic\n";
echo "================================\n";
foreach ($checks as $name => $check) {
    $status = $check['ok'] === null ? 'INFO' : ($check['ok'] ? 'OK' : 'FAIL');
    echo sprintf("[%s] %-22s %s\n", $status, $name . ':', $check['value']);
    if ($check['ok'] === false) {
        $failed = true;
    }
}

echo "\nInterpretation:\n";
if (!$checks['origin_match']['ok'] && $origin !== '') {
    echo "- The supplied browser origin is not allowed; update ALLOWED_ORIGINS in Instapods.\n";
}
if (($checks['pdo_connection']['ok'] ?? false) === false) {
    echo "- Database connectivity failed; use the PDO error above to correct the deployment secret.\n";
}
if (!$failed) {
    echo "- Configuration, CORS origin, and database connectivity passed.\n";
}

exit($failed ? 1 : 0);
