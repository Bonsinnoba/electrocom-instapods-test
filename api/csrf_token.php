<?php
// api/csrf_token.php
// Generate and return CSRF token for frontend

require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

// Generate CSRF token
$token = generateCSRFToken();

echo json_encode([
    'success' => true,
    'data' => [
        'csrf_token' => $token
    ]
]);