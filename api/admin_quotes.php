<?php
// api/admin_quotes.php
// Staff builds and sends priced quotes in response to a quote_request.
// GET ?quote_request_id=X (list) / GET ?id=X (single quote + items)
// POST { action: 'create', quote_request_id, items, discount, tax, payment_terms, valid_until, terms_notes }
// POST { action: 'void', id }

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

        $stmt = $pdo->prepare("SELECT * FROM quotes WHERE id = ?");
        $stmt->execute([$id]);
        $quote = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$quote) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Quote not found']);
            exit;
        }

        $itemsStmt = $pdo->prepare("SELECT * FROM quote_items WHERE quote_id = ?");
        $itemsStmt->execute([$id]);
        $quote['items'] = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'data' => $quote]);
        exit;
    }

    $quoteRequestId = validateInt($_GET['quote_request_id'] ?? null, 1);
    if (!$quoteRequestId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'quote_request_id is required']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT * FROM quotes WHERE quote_request_id = ? ORDER BY created_at DESC");
    $stmt->execute([$quoteRequestId]);
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    exit;
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $body['action'] ?? '';

    if ($action === 'create') {
        $quoteRequestId = validateInt($body['quote_request_id'] ?? null, 1);
        $items = $body['items'] ?? [];
        $paymentTerms = sanitizeInput($body['payment_terms'] ?? 'due_on_receipt');
        $validUntil = $body['valid_until'] ?? null;
        $termsNotes = sanitizeInput($body['terms_notes'] ?? '');
        $discountInput = (float)($body['discount'] ?? 0);
        $taxInput = (float)($body['tax'] ?? 0);

        if (!$quoteRequestId || !is_array($items) || empty($items)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'quote_request_id and at least one item are required']);
            exit;
        }

        $allowedTerms = ['due_on_receipt', 'net_15', 'net_30', 'net_60'];
        if (!in_array($paymentTerms, $allowedTerms, true)) {
            $paymentTerms = 'due_on_receipt';
        }
        if ($validUntil !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $validUntil)) {
            $validUntil = null;
        }

        try {
            $pdo->beginTransaction();

            $reqStmt = $pdo->prepare("SELECT id, status FROM quote_requests WHERE id = ? FOR UPDATE");
            $reqStmt->execute([$quoteRequestId]);
            $quoteRequest = $reqStmt->fetch(PDO::FETCH_ASSOC);

            if (!$quoteRequest) {
                throw new Exception('Quote request not found');
            }
            if (in_array($quoteRequest['status'], ['accepted', 'rejected', 'expired'], true)) {
                throw new Exception("This request is already {$quoteRequest['status']} and can't be quoted again.");
            }

            // Server-side recompute — never trust a client-sent subtotal/total.
            $subtotal = 0.0;
            $cleanItems = [];
            foreach ($items as $item) {
                $qty = max(1, (int)($item['quantity'] ?? 1));
                $unitPrice = max(0, (float)($item['unit_price'] ?? 0));
                $productId = (!empty($item['product_id'])) ? (int)$item['product_id'] : null;
                $description = sanitizeInput($item['description'] ?? '');
                $subtotal += $qty * $unitPrice;
                $cleanItems[] = [$productId, $description, $qty, $unitPrice];
            }

            $discount = max(0, $discountInput);
            $tax = max(0, $taxInput);
            $total = max(0, $subtotal - $discount + $tax);

            $quoteStmt = $pdo->prepare("
                INSERT INTO quotes (quote_request_id, created_by, subtotal, discount, tax, total, payment_terms, valid_until, terms_notes, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent')
            ");
            $quoteStmt->execute([
                $quoteRequestId, $userId, $subtotal, $discount, $tax, $total, $paymentTerms,
                $validUntil, $termsNotes,
            ]);
            $quoteId = (int)$pdo->lastInsertId();

            $itemStmt = $pdo->prepare("INSERT INTO quote_items (quote_id, product_id, description, quantity, unit_price) VALUES (?, ?, ?, ?, ?)");
            foreach ($cleanItems as $ci) {
                $itemStmt->execute([$quoteId, $ci[0], $ci[1], $ci[2], $ci[3]]);
            }

            $pdo->prepare("UPDATE quote_requests SET status = 'quoted' WHERE id = ?")->execute([$quoteRequestId]);
            $pdo->prepare("INSERT INTO quote_activity_log (quote_request_id, status_key, message, actor_id) VALUES (?, 'quoted', ?, ?)")
                ->execute([$quoteRequestId, "Quote #{$quoteId} (GH₵" . number_format($total, 2) . ") sent by {$userName}", $userId]);

            // Notify institution contacts who can act on this quote.
            $contactsStmt = $pdo->prepare("
                SELECT ic.user_id FROM institution_contacts ic
                JOIN quote_requests qr ON qr.institution_id = ic.institution_id
                WHERE qr.id = ?
            ");
            $contactsStmt->execute([$quoteRequestId]);
            $notifStmt = $pdo->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'New Quote Received', ?, 'info')");
            foreach ($contactsStmt->fetchAll(PDO::FETCH_COLUMN) as $contactUserId) {
                $notifStmt->execute([$contactUserId, "You've received a quote for GH₵" . number_format($total, 2) . ". Review and respond in your account."]);
            }

            $pdo->commit();

            logger('ok', 'QUOTES', "Quote #{$quoteId} created for request #{$quoteRequestId} by {$userName} (GH₵{$total})");
            echo json_encode(['success' => true, 'message' => 'Quote sent', 'data' => ['id' => $quoteId, 'total' => $total]]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'void') {
        $id = validateInt($body['id'] ?? null, 1);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'A valid id is required']);
            exit;
        }

        try {
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("SELECT * FROM quotes WHERE id = ? FOR UPDATE");
            $stmt->execute([$id]);
            $quote = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$quote) {
                throw new Exception('Quote not found');
            }
            if ($quote['status'] !== 'sent') {
                throw new Exception("Only a quote that is currently 'sent' can be voided (this one is {$quote['status']}).");
            }

            $pdo->prepare("UPDATE quotes SET status = 'rejected' WHERE id = ?")->execute([$id]);
            // Revert the parent request back to under_review so staff can build
            // a fresh quote, instead of leaving it stuck at 'quoted' with no valid quote.
            $pdo->prepare("UPDATE quote_requests SET status = 'under_review' WHERE id = ? AND status = 'quoted'")
                ->execute([$quote['quote_request_id']]);

            $pdo->prepare("INSERT INTO quote_activity_log (quote_request_id, status_key, message, actor_id) VALUES (?, 'voided', ?, ?)")
                ->execute([$quote['quote_request_id'], "Quote #{$id} voided by staff ({$userName})", $userId]);

            $pdo->commit();

            logger('ok', 'QUOTES', "Quote #{$id} voided by {$userName}");
            echo json_encode(['success' => true, 'message' => 'Quote voided']);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Unknown action']);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
