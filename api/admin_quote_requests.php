<?php
// api/admin_quote_requests.php
// Staff-facing inbox for institutional quote requests (RFQs).
// GET (list, optional ?status=) / GET ?id=X (detail with items + quotes)
// POST { action: 'set_status', id, status }
// POST { action: 'add_note', id, note }

require_once 'cors_middleware.php';
require_once 'db.php';
require_once 'security.php';
require_once __DIR__ . '/order_utils.php';

header('Content-Type: application/json');

try {
    $userId = requireRole(['sales'], $pdo);
    $userName = getUserName($userId, $pdo);
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

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if (isset($_GET['id'])) {
        $id = validateInt($_GET['id'], 1);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'A valid id is required']);
            exit;
        }

        $stmt = $pdo->prepare("
            SELECT qr.*, i.name AS institution_name, u.name AS submitted_by_name
            FROM quote_requests qr
            JOIN institutions i ON qr.institution_id = i.id
            JOIN users u ON qr.submitted_by = u.id
            WHERE qr.id = ?
        ");
        $stmt->execute([$id]);
        $request = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$request) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Quote request not found']);
            exit;
        }

        $itemsStmt = $pdo->prepare("
            SELECT qri.*, p.name AS product_name, p.price AS product_price
            FROM quote_request_items qri
            LEFT JOIN products p ON qri.product_id = p.id
            WHERE qri.quote_request_id = ?
        ");
        $itemsStmt->execute([$id]);
        $request['items'] = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

        $quotesStmt = $pdo->prepare("SELECT * FROM quotes WHERE quote_request_id = ? ORDER BY created_at DESC");
        $quotesStmt->execute([$id]);
        $request['quotes'] = $quotesStmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'data' => $request]);
        exit;
    }

    $status = $_GET['status'] ?? null;
    $sql = "
        SELECT qr.id, qr.status, qr.created_at, i.name AS institution_name, u.name AS submitted_by_name,
               (SELECT COUNT(*) FROM quote_request_items WHERE quote_request_id = qr.id) AS item_count
        FROM quote_requests qr
        JOIN institutions i ON qr.institution_id = i.id
        JOIN users u ON qr.submitted_by = u.id
    ";
    $params = [];
    if ($status) {
        $sql .= " WHERE qr.status = ?";
        $params[] = $status;
    }
    $sql .= " ORDER BY qr.created_at DESC LIMIT 200";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    exit;
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $body['action'] ?? '';

    if ($action === 'set_status') {
        $id = validateInt($body['id'] ?? null, 1);
        $status = sanitizeInput($body['status'] ?? '');
        $allowed = ['draft', 'submitted', 'under_review', 'quoted', 'accepted', 'rejected', 'expired'];

        if (!$id || !in_array($status, $allowed, true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'A valid id and status are required']);
            exit;
        }

        $check = $pdo->prepare("SELECT id FROM quote_requests WHERE id = ?");
        $check->execute([$id]);
        if (!$check->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Quote request not found']);
            exit;
        }

        $pdo->prepare("UPDATE quote_requests SET status = ? WHERE id = ?")->execute([$status, $id]);
        $pdo->prepare("INSERT INTO quote_activity_log (quote_request_id, status_key, message, actor_id) VALUES (?, ?, ?, ?)")
            ->execute([$id, $status, "Status changed to " . str_replace('_', ' ', $status) . " by {$userName}", $userId]);

        logger('ok', 'QUOTES', "Quote request #{$id} status set to {$status} by {$userName}");
        echo json_encode(['success' => true, 'message' => 'Status updated']);
        exit;
    }

    if ($action === 'add_note') {
        $id = validateInt($body['id'] ?? null, 1);
        $note = sanitizeInput($body['note'] ?? '');

        if (!$id || $note === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'A valid id and note are required']);
            exit;
        }

        $check = $pdo->prepare("SELECT id FROM quote_requests WHERE id = ?");
        $check->execute([$id]);
        if (!$check->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Quote request not found']);
            exit;
        }

        $pdo->prepare("UPDATE quote_requests SET notes = ? WHERE id = ?")->execute([$note, $id]);
        $pdo->prepare("INSERT INTO quote_activity_log (quote_request_id, status_key, message, actor_id) VALUES (?, 'note', ?, ?)")
            ->execute([$id, "Note added by {$userName}: {$note}", $userId]);

        echo json_encode(['success' => true, 'message' => 'Note saved']);
        exit;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Unknown action']);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
