<?php
// api/admin_institutions.php
// CRUD + verification workflow for institutional (B2B) accounts.
require_once 'cors_middleware.php';
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

try {
    $userId = requireRole(['sales'], $pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
}

// Validate CSRF token for state-changing requests
if (in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PUT', 'DELETE'])) {
    $csrfToken = getCSRFTokenFromRequest();
    if (!validateCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired CSRF token.']);
        exit;
    }
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $id = validateInt($_GET['id'] ?? null);

    if ($id) {
        $stmt = $pdo->prepare("
            SELECT i.*, u.name AS verified_by_name
            FROM institutions i
            LEFT JOIN users u ON i.verified_by = u.id
            WHERE i.id = ?
        ");
        $stmt->execute([$id]);
        $institution = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$institution) {
            sendResponse(false, 'Institution not found', null, 404);
        }

        $contactsStmt = $pdo->prepare("
            SELECT ic.id, ic.title, ic.is_primary, u.id AS user_id, u.name, u.email, u.phone
            FROM institution_contacts ic
            JOIN users u ON ic.user_id = u.id
            WHERE ic.institution_id = ?
            ORDER BY ic.is_primary DESC, u.name ASC
        ");
        $contactsStmt->execute([$id]);
        $institution['contacts'] = $contactsStmt->fetchAll(PDO::FETCH_ASSOC);

        sendResponse(true, 'Institution fetched', $institution);
    }

    $status = $_GET['status'] ?? null;
    $params = [];
    $sql = "SELECT i.*, 
                   (SELECT COUNT(*) FROM quote_requests qr WHERE qr.institution_id = i.id) AS quote_request_count
            FROM institutions i";
    if ($status) {
        $sql .= " WHERE i.status = ?";
        $params[] = sanitizeInput($status);
    }
    $sql .= " ORDER BY i.created_at DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    sendResponse(true, 'Institutions fetched', $stmt->fetchAll(PDO::FETCH_ASSOC));
}

$payload = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $payload['action'] ?? '';

try {
    if ($action === 'create') {
        $name = sanitizeInput($payload['name'] ?? '');
        $type = sanitizeInput($payload['type'] ?? 'other');
        $taxId = sanitizeInput($payload['tax_id'] ?? '');
        $billingAddress = sanitizeInput($payload['billing_address'] ?? '');
        $phone = sanitizeInput($payload['phone'] ?? '');
        $email = sanitizeInput($payload['email'] ?? '');
        $notes = sanitizeInput($payload['notes'] ?? '');

        if ($name === '') {
            sendResponse(false, 'Institution name is required', null, 400);
        }

        $validTypes = ['school', 'hospital', 'corporate', 'government', 'ngo', 'other'];
        if (!in_array($type, $validTypes, true)) {
            $type = 'other';
        }

        $stmt = $pdo->prepare("
            INSERT INTO institutions (name, type, tax_id, billing_address, phone, email, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
        ");
        $stmt->execute([$name, $type, $taxId, $billingAddress, $phone, $email, $notes]);
        sendResponse(true, 'Institution created', ['id' => (int)$pdo->lastInsertId()]);
    }

    if ($action === 'update') {
        $id = validateInt($payload['id'] ?? null, 1);
        $name = sanitizeInput($payload['name'] ?? '');
        $type = sanitizeInput($payload['type'] ?? 'other');
        $taxId = sanitizeInput($payload['tax_id'] ?? '');
        $billingAddress = sanitizeInput($payload['billing_address'] ?? '');
        $phone = sanitizeInput($payload['phone'] ?? '');
        $email = sanitizeInput($payload['email'] ?? '');
        $notes = sanitizeInput($payload['notes'] ?? '');

        if (!$id || $name === '') {
            sendResponse(false, 'Valid id and name are required', null, 400);
        }

        $stmt = $pdo->prepare("
            UPDATE institutions
            SET name = ?, type = ?, tax_id = ?, billing_address = ?, phone = ?, email = ?, notes = ?
            WHERE id = ?
        ");
        $stmt->execute([$name, $type, $taxId, $billingAddress, $phone, $email, $notes, $id]);
        sendResponse(true, 'Institution updated');
    }

    // Verification workflow: pending -> verified -> suspended (or back to verified)
    if ($action === 'set_status') {
        $id = validateInt($payload['id'] ?? null, 1);
        $status = sanitizeInput($payload['status'] ?? '');
        $validStatuses = ['pending', 'verified', 'suspended'];

        if (!$id || !in_array($status, $validStatuses, true)) {
            sendResponse(false, 'Valid id and status are required', null, 400);
        }

        if ($status === 'verified') {
            $stmt = $pdo->prepare("
                UPDATE institutions SET status = ?, verified_by = ?, verified_at = NOW() WHERE id = ?
            ");
            $stmt->execute([$status, $userId, $id]);
        } else {
            $stmt = $pdo->prepare("UPDATE institutions SET status = ? WHERE id = ?");
            $stmt->execute([$status, $id]);
        }
        sendResponse(true, 'Institution status updated');
    }

    // Link an existing user (must already have an account) as an institution contact
    if ($action === 'add_contact') {
        $institutionId = validateInt($payload['institution_id'] ?? null, 1);
        $email = sanitizeInput($payload['email'] ?? '');
        $title = sanitizeInput($payload['title'] ?? '');
        $isPrimary = !empty($payload['is_primary']);

        if (!$institutionId || $email === '') {
            sendResponse(false, 'Institution id and contact email are required', null, 400);
        }

        $userStmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $userStmt->execute([$email]);
        $contactUserId = $userStmt->fetchColumn();

        if (!$contactUserId) {
            sendResponse(false, 'No user account found with that email. Ask them to register first.', null, 404);
        }

        if ($isPrimary) {
            $pdo->prepare("UPDATE institution_contacts SET is_primary = FALSE WHERE institution_id = ?")
                ->execute([$institutionId]);
        }

        $stmt = $pdo->prepare("
            INSERT INTO institution_contacts (institution_id, user_id, title, is_primary)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE title = VALUES(title), is_primary = VALUES(is_primary)
        ");
        $stmt->execute([$institutionId, $contactUserId, $title, $isPrimary ? 1 : 0]);
        sendResponse(true, 'Contact linked to institution');
    }

    if ($action === 'remove_contact') {
        $contactId = validateInt($payload['contact_id'] ?? null, 1);
        if (!$contactId) {
            sendResponse(false, 'Valid contact id is required', null, 400);
        }
        $pdo->prepare("DELETE FROM institution_contacts WHERE id = ?")->execute([$contactId]);
        sendResponse(true, 'Contact removed');
    }

    sendResponse(false, 'Invalid action', null, 400);
} catch (Exception $e) {
    error_log('admin_institutions error: ' . $e->getMessage());
    sendResponse(false, 'Request failed', null, 500);
}
