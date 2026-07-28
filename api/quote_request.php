<?php
// api/quote_request.php
// Customer/institution-facing: submit and view RFQs. Callable by any
// authenticated 'customer' user who is linked via institution_contacts -
// no special role needed, this is not a staff endpoint.
require_once 'cors_middleware.php';
require_once 'db.php';
require_once 'security.php';
require_once __DIR__ . '/order_utils.php';

header('Content-Type: application/json');

try {
    $userId = authenticate($pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
}

if (in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PUT', 'DELETE'])) {
    $csrfToken = getCSRFTokenFromRequest();
    if (!validateCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired CSRF token.']);
        exit;
    }
}

ensure_institutional_and_delivery_tables($pdo);

function logQuoteEvent($quoteRequestId, $statusKey, $message, $actorId, $pdo)
{
    try {
        $stmt = $pdo->prepare("INSERT INTO quote_activity_log (quote_request_id, status_key, message, actor_id) VALUES (?, ?, ?, ?)");
        $stmt->execute([$quoteRequestId, $statusKey, $message, $actorId]);
    } catch (Exception $e) {
        error_log('Failed to log quote event: ' . $e->getMessage());
    }
}

/** Confirms $userId is a contact for $institutionId and that institution is verified. */
function assertVerifiedContact($userId, $institutionId, $pdo)
{
    $stmt = $pdo->prepare("
        SELECT i.status FROM institution_contacts ic
        JOIN institutions i ON ic.institution_id = i.id
        WHERE ic.user_id = ? AND ic.institution_id = ?
    ");
    $stmt->execute([$userId, $institutionId]);
    $status = $stmt->fetchColumn();

    if ($status === false) {
        sendResponse(false, 'You are not a registered contact for this institution.', null, 403);
    }
    if ($status !== 'verified') {
        sendResponse(false, 'This institution account is not verified yet. Contact support to complete verification.', null, 403);
    }
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $id = validateInt($_GET['id'] ?? null);

    if ($id) {
        $stmt = $pdo->prepare("
            SELECT qr.*, i.name AS institution_name
            FROM quote_requests qr
            JOIN institutions i ON qr.institution_id = i.id
            JOIN institution_contacts ic ON ic.institution_id = qr.institution_id
            WHERE qr.id = ? AND ic.user_id = ?
        ");
        $stmt->execute([$id, $userId]);
        $request = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$request) {
            sendResponse(false, 'Quote request not found', null, 404);
        }

        $itemsStmt = $pdo->prepare("
            SELECT qri.*, p.name AS product_name FROM quote_request_items qri
            LEFT JOIN products p ON qri.product_id = p.id WHERE qri.quote_request_id = ?
        ");
        $itemsStmt->execute([$id]);
        $request['items'] = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

        $quotesStmt = $pdo->prepare("SELECT id, status, total, valid_until, payment_terms, created_at FROM quotes WHERE quote_request_id = ? ORDER BY created_at DESC");
        $quotesStmt->execute([$id]);
        $request['quotes'] = $quotesStmt->fetchAll(PDO::FETCH_ASSOC);

        sendResponse(true, 'Quote request fetched', $request);
    }

    // List every request across every institution this user is linked to
    $stmt = $pdo->prepare("
        SELECT qr.id, qr.status, qr.created_at, i.name AS institution_name
        FROM quote_requests qr
        JOIN institutions i ON qr.institution_id = i.id
        JOIN institution_contacts ic ON ic.institution_id = qr.institution_id
        WHERE ic.user_id = ?
        ORDER BY qr.created_at DESC
    ");
    $stmt->execute([$userId]);
    sendResponse(true, 'Quote requests fetched', $stmt->fetchAll(PDO::FETCH_ASSOC));
}

$payload = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $payload['action'] ?? '';

try {
    if ($action === 'create') {
        $institutionId = validateInt($payload['institution_id'] ?? null, 1);
        $items = $payload['items'] ?? [];
        $notes = sanitizeInput($payload['notes'] ?? '');

        if (!$institutionId || empty($items) || !is_array($items)) {
            sendResponse(false, 'An institution and at least one requested item are required', null, 400);
        }

        assertVerifiedContact($userId, $institutionId, $pdo);

        $pdo->beginTransaction();

        $stmt = $pdo->prepare("INSERT INTO quote_requests (institution_id, submitted_by, status, notes) VALUES (?, ?, 'submitted', ?)");
        $stmt->execute([$institutionId, $userId, $notes]);
        $requestId = (int)$pdo->lastInsertId();

        $itemStmt = $pdo->prepare("INSERT INTO quote_request_items (quote_request_id, product_id, quantity, notes) VALUES (?, ?, ?, ?)");
        foreach ($items as $item) {
            $productId = validateInt($item['product_id'] ?? null);
            $quantity = validateInt($item['quantity'] ?? 1, 1) ?? 1;
            $itemNotes = sanitizeInput($item['notes'] ?? '');
            $itemStmt->execute([$requestId, $productId, $quantity, $itemNotes]);
        }

        $pdo->commit();

        logQuoteEvent($requestId, 'submitted', 'Quote request submitted', $userId, $pdo);

        // Let sales staff know something needs review
        $salesStmt = $pdo->query("SELECT id FROM users WHERE role = 'sales'");
        $notifStmt = $pdo->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'New Quote Request', ?, 'info')");
        foreach ($salesStmt->fetchAll(PDO::FETCH_COLUMN) as $salesUserId) {
            $notifStmt->execute([$salesUserId, "A new institutional quote request (#{$requestId}) needs review."]);
        }

        sendResponse(true, 'Quote request submitted', ['id' => $requestId]);
    }

    sendResponse(false, 'Invalid action', null, 400);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('quote_request error: ' . $e->getMessage());
    sendResponse(false, 'Request failed', null, 500);
}
