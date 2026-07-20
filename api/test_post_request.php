<?php
// Test script to simulate POST request to super_settings.php
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/logs/php_errors.log');

echo "Testing POST request to super_settings.php...\n\n";

// Create a test payload
$payload = [
    'primaryColor' => '#ff0000',
    'siteName' => 'Test Store'
];

echo "Payload: " . json_encode($payload) . "\n\n";

// Try to make a cURL request
$ch = curl_init('http://localhost:8000/super_settings.php');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'X-App-ID: admin'
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);

curl_close($ch);

echo "HTTP Code: $httpCode\n";
echo "Response: $response\n";
if ($curlError) {
    echo "cURL Error: $curlError\n";
}
