<?php
// backend/db.php
// Secure Database Connection Configuration using PDO

ob_start();
date_default_timezone_set('GMT');

// Include centralized configuration loader
if (!isset($config) || !is_array($config)) {
    $config = require_once __DIR__ . '/config.php';
}
require_once 'cors_middleware.php';

$host = $config['DB_HOST'];
$user = $config['DB_USER'];
$pass = $config['DB_PASS'];
$db   = $config['DB_NAME'];
$charset = 'utf8mb4';

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
    // Prevent HY000/2014 when middleware and migrations run sequential queries.
    PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
];

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";

try {
    $pdo = new PDO($dsn, $user, $pass, $options);

    // Global Security Middleware
    if (file_exists('security.php')) {
        require_once 'security.php';

        // --- NEW: Enhanced Error & Exception Handling ---
        // Capture warnings/notices and pipe to custom logger
        set_error_handler(function($errno, $errstr, $errfile, $errline) {
            if (!(error_reporting() & $errno)) return false;
            $msg = "PHP Error [$errno]: $errstr in $errfile on line $errline";
            logger('warn', 'PHP_ERROR', $msg);
            return false; // Let standard PHP error handling continue as well
        });

        // Capture uncaught exceptions
        set_exception_handler(function($e) {
            $msg = "Uncaught Exception: " . $e->getMessage() . "\nStack Trace:\n" . $e->getTraceAsString();
            logger('error', 'EXCEPTION', $msg);
            // Default behavior after logging
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'An unexpected server error occurred. Details have been logged.']);
            exit;
        });

        // Capture Fatal Errors (Shutdown)
        register_shutdown_function(function() {
            $error = error_get_last();
            if ($error !== null && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
                $msg = "FATAL ERROR [{$error['type']}]: {$error['message']} in {$error['file']} on line {$error['line']}";
                logger('error', 'FATAL', $msg);
            }
        });
        // -------------------------------------------------

        // --- NEW: Debug Mode Logic ---
        if (isDebugEnabled()) {
            ini_set('display_errors', 1);
            ini_set('display_startup_errors', 1);
            error_reporting(E_ALL);
        }
        // -----------------------------

        checkRateLimit($pdo, 300, 60, 'global');
        checkMaintenanceMode($pdo);

        // Include traffic monitor now that $pdo is ready
        if (file_exists('traffic_monitor.php')) {
            require_once 'traffic_monitor.php';
            if (function_exists('monitorTraffic')) {
                monitorTraffic();
            }
        }

        // --- Centralized Migrations ---
        if ($config['DB_AUTO_REPAIR'] ?? false) {
            require_once 'migrations.php';
            runMigrations($pdo);
        }
    }
} catch (\Throwable $e) {
    // SECURITY: Don't expose database credentials/paths in production
    // UNLESS Debug Mode is explicitly enabled
    $message = 'Internal Server Error: Service Unavailable.';

    // Check debug status if security.php was loaded, otherwise check file directly
    $debug = false;
    if (function_exists('isDebugEnabled')) {
        $debug = isDebugEnabled();
    } else {
        $sf = __DIR__ . '/data/super_settings.json';
        if (file_exists($sf)) {
            $s = json_decode(file_get_contents($sf), true);
            $debug = isset($s['debugMode']) && $s['debugMode'] === true;
        }
    }

    if ($debug) {
        $message = "DATABASE CONNECTION ERROR: " . $e->getMessage();
    } else {
        error_log("Database connection failed: " . $e->getMessage());
    }

    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $message,
        'debug_info' => $debug ? [
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => explode("\n", $e->getTraceAsString())
        ] : null
    ]);
    exit;
}

/**
 * Helper function to handle JSON responses consistently
 */
if (!function_exists('sendResponse')) {
    function sendResponse(bool $success, string $message, mixed $data = null, int $code = 200): never
    {
        header('Content-Type: application/json');
        http_response_code($code);
        echo json_encode([
            'success' => $success,
            'message' => $message,
            'data' => $data
        ]);
        exit;
    }
}

/**
 * Helper to handle database errors cleanly: logs the full details for the developer,
 * and sends a safe, polished message to the frontend.
 */
if (!function_exists('sendDatabaseError')) {
    function sendDatabaseError(Exception $e, $customMessage = 'A system error occurred. Please try again.')
    {
        $config = $GLOBALS['config'] ?? [];
        $isDev = ($config['APP_ENV'] ?? 'production') === 'development';
        
        // Log the detailed error message for developer review
        $logMessage = $e->getMessage() . "\nStack trace:\n" . $e->getTraceAsString();
        if (function_exists('logApp')) {
            logApp('error', 'DATABASE', $logMessage);
        } else {
            error_log("[DATABASE ERROR] " . $logMessage);
        }
        
        // Build the safe error message to expose to users
        $outputMessage = $customMessage;
        if ($isDev) {
            $outputMessage .= ' (Dev Mode Detail: ' . $e->getMessage() . ')';
        }
        
        sendResponse(false, $outputMessage, null, 500);
    }
}

/**
 * Custom logging to app.log
 */
if (!function_exists('logApp')) {
    function logApp(string $level, string $source, string $message): void {
        $level = strtolower($level);
        // Only log info messages if debug mode is on
        if ($level === 'info' && function_exists('isDebugEnabled') && !isDebugEnabled()) {
            return;
        }

        if (function_exists('logger')) {
            logger($level, $source, $message);
            return;
        }

        $file = __DIR__ . '/logs/app.log';
        if (!is_dir(__DIR__ . '/logs')) mkdir(__DIR__ . '/logs', 0755, true);
        $ts = date('Y-m-d H:i:s');
        $line = "$ts [" . strtoupper($level) . "] [" . strtoupper($source) . "] $message\n";
        file_put_contents($file, $line, FILE_APPEND);
    }
}

/**
 * Helper function to generate avatar initials (first letter of first and last name)
 */
if (!function_exists('generateInitials')) {
    function generateInitials(?string $name): string {
        $name = trim($name ?? '');
        if (empty($name)) return 'U';
        
        $parts = preg_split('/\s+/', $name);
        if (count($parts) >= 2) {
            $first = mb_substr($parts[0], 0, 1);
            $last = mb_substr(end($parts), 0, 1);
            return strtoupper($first . $last);
        }
        
        return strtoupper(mb_substr($name, 0, 2));
    }
}
/**
 * Helper to normalize local paths by stripping domain/base URLs.
 */
if (!function_exists('normalizeLocalPath')) {
    function normalizeLocalPath(string $path): string
    {
        if (empty($path)) return '';
        if (strpos($path, 'data:image') === 0) return $path;

        $bases = $GLOBALS['config']['ALLOWED_IMAGE_BASES'] ?? [
            'http://localhost:8000/api/',
            'http://localhost:8000/',
            'http://127.0.0.1:8000/api/',
            'http://127.0.0.1:8000/',
            'http://electrocom.local/api/',
            'http://electrocom.local/',
            'https://electrocom.local/api/',
            'https://electrocom.local/'
        ];
        foreach ($bases as $base) {
            if (strpos($path, $base) === 0) {
                return str_replace($base, '', $path);
            }
        }
        return $path;
    }
}
