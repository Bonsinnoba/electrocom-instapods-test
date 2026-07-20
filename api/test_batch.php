<?php
// Test batch endpoint
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "Testing batch endpoint...\n\n";

// Test with public resources only (no auth required)
$payload = json_encode(['resources' => ['products', 'categories', 'settings']]);

$ch = curl_init('http://localhost:8000/batch.php');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: $httpCode\n";
echo "Response: $response\n";
