<?php
// api/quote_response.php
// Customer/institution-facing: view a sent quote and accept/reject it.
// Acceptance creates an order directly with payment_method = 'invoice'
// and status = 'pending' - it deliberately does NOT call completeOrder()
// from order_utils.php, since that function assumes a paid order (stock
// decrement, receipt email, etc.). Invoice/Net-30 orders get marked paid
// later through the normal admin_orders.php flow once payment is received.
require_once 'cors_middleware.php';
require_once 'db.php';
require_once 'security.php';
require_once __DIR__ . '/order_utils.php'; // for logOrderEvent()

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

/** Fetch a quote and confirm $userId is a contact of the owning institution. Returns the quote row (with quote_request_id, institution_id) or sends a 403/404. */
function loadAuthorizedQuote($quoteId, $userId, $pdo)
{
    $stmt = $pdo->prepare("
        SELECT q.*, qr.institution_id, qr.submitted_by
        FROM quotes q
        JOIN quote_requests qr ON q.quote_request_id = qr.id
        JOIN institution_contacts ic ON ic.institution_id = qr.institution_id
        WHERE q.id = ? AND ic.user_id = ?
    ");
    $stmt->execute([$quoteId, $userId]);
    $quote = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$quote) {
        sendResponse(false, 'Quote not found, or you are not authorized to view it.', null, 404);
    }
    return $quote;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $quoteId = validateInt($_GET['quote_id'] ?? null, 1);
    if (!$quoteId) {
        sendResponse(false, 'A valid quote_id is required', null, 400);
    }

    $quote = loadAuthorizedQuote($quoteId, $userId, $pdo);

    $itemsStmt = $pdo->prepare("SELECT qi.*, p.name AS product_name FROM quote_items qi LEFT JOIN products p ON qi.product_id = p.id WHERE qi.quote_id = ?");
    $itemsStmt->execute([$quoteId]);
    $quote['items'] = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

    sendResponse(true, 'Quote fetched', $quote);
}

$payload = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $payload['action'] ?? '';

try {
    if ($action === 'accept') {
        $quoteId = validateInt($payload['quote_id'] ?? null, 1);
        $shippingAddress = sanitizeInput($payload['shipping_address'] ?? '');
        $deliveryMethod = sanitizeInput($payload['delivery_method'] ?? 'door_to_door');

        if (!$quoteId) {
            sendResponse(false, 'A valid quote_id is required', null, 400);
        }

        $quote = loadAuthorizedQuote($quoteId, $userId, $pdo);

        if ($quote['status'] !== 'sent') {
            sendResponse(false, "This quote is {$quote['status']} and can no longer be accepted.", null, 400);
        }

        $itemsStmt = $pdo->prepare("SELECT product_id, quantity, unit_price FROM quote_items WHERE quote_id = ?");
        $itemsStmt->execute([$quoteId]);
        $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

        $pdo->beginTransaction();

        $orderStmt = $pdo->prepare("
            INSERT INTO orders (user_id, institution_id, quote_id, total_amount, status, delivery_method, shipping_address, payment_method)
            VALUES (?, ?, ?, ?, 'pending', ?, ?, 'invoice')
        ");
        $orderStmt->execute([
            $quote['submitted_by'], $quote['institution_id'], $quoteId,
            $quote['total'], $deliveryMethod, $shippingAddress,
        ]);
        $orderId = (int)$pdo->lastInsertId();

        $orderItemStmt = $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)");
        foreach ($items as $item) {
            $orderItemStmt->execute([$orderId, $item['product_id'], $item['quantity'], $item['unit_price']]);
        }

        $pdo->prepare("UPDATE quotes SET status = 'accepted' WHERE id = ?")->execute([$quoteId]);
        $pdo->prepare("UPDATE quote_requests SET status = 'accepted' WHERE id = ?")->execute([$quote['quote_request_id']]);

        $pdo->commit();

        logQuoteEvent($quote['quote_request_id'], 'accepted', "Quote #{$quoteId} accepted - order #{$orderId} created ({$quote['payment_terms']})", $userId, $pdo);
        logOrderEvent($orderId, 'created', "Order created from accepted institutional quote #{$quoteId}", $pdo);

        $notifStmt = $pdo->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Quote Accepted', ?, 'info')");
        $notifStmt->execute([$quote['created_by'], "Quote #{$quoteId} was accepted. Order #{$orderId} has been created ({$quote['payment_terms']})."]);

        sendResponse(true, 'Quote accepted, order created', ['order_id' => $orderId]);
    }

    if ($action === 'reject') {
        $quoteId = validateInt($payload['quote_id'] ?? null, 1);
        $reason = sanitizeInput($payload['reason'] ?? '');

        if (!$quoteId) {
            sendResponse(false, 'A valid quote_id is required', null, 400);
        }

        $quote = loadAuthorizedQuote($quoteId, $userId, $pdo);

        if ($quote['status'] !== 'sent') {
            sendResponse(false, "This quote is {$quote['status']} and can no longer be rejected.", null, 400);
        }

        $pdo->prepare("UPDATE quotes SET status = 'rejected' WHERE id = ?")->execute([$quoteId]);
        $pdo->prepare("UPDATE quote_requests SET status = 'rejected' WHERE id = ?")->execute([$quote['quote_request_id']]);

        logQuoteEvent($quote['quote_request_id'], 'rejected', "Quote #{$quoteId} rejected by institution" . ($reason ? ": {$reason}" : ''), $userId, $pdo);

        $notifStmt = $pdo->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Quote Rejected', ?, 'info')");
        $notifStmt->execute([$quote['created_by'], "Quote #{$quoteId} was rejected by the institution." . ($reason ? " Reason: {$reason}" : '')]);

        sendResponse(true, 'Quote rejected');
    }

    sendResponse(false, 'Invalid action', null, 400);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('quote_response error: ' . $e->getMessage());
    sendResponse(false, 'Request failed', null, 500);
}
