<?php
// Test POST request to super_settings.php
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Simulate POST request
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer test_token';
$_SERVER['HTTP_X_APP_ID'] = 'admin';

// Create test payload
$testPayload = [
    'siteName' => 'Test Store',
    'siteEmail' => 'test@example.com',
    'maintenanceMode' => false,
    'vatRate' => 15
];

// Simulate php://input
$tempFile = tempnam(sys_get_temp_dir(), 'php_input');
file_put_contents($tempFile, json_encode($testPayload));

// Override php://input stream
stream_wrapper_unregister('php');
stream_wrapper_register('php', 'PhpInputStreamWrapper');

class PhpInputStreamWrapper {
    private $position = 0;
    private $data;
    
    public function stream_open($path, $mode, $options, &$opened_path) {
        if ($path === 'php://input') {
            global $tempFile;
            $this->data = file_get_contents($tempFile);
            return true;
        }
        return false;
    }
    
    public function stream_read($count) {
        $result = substr($this->data, $this->position, $count);
        $this->position += strlen($result);
        return $result;
    }
    
    public function stream_eof() {
        return $this->position >= strlen($this->data);
    }
    
    public function stream_stat() {
        return [];
    }
}

echo "Testing POST to super_settings.php...\n";
echo "Payload: " . json_encode($testPayload) . "\n\n";

try {
    // This will fail due to authentication, but we can see if the basic flow works
    include 'super_settings.php';
} catch (Exception $e) {
    echo "Exception: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . ":" . $e->getLine() . "\n";
    echo "Trace:\n" . $e->getTraceAsString() . "\n";
}

// Cleanup
unlink($tempFile);
stream_wrapper_restore('php');
