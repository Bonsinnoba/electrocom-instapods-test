<?php
// backend/cms.php
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $slug = $_GET['slug'] ?? null;
    $all = $_GET['all'] ?? false;

    // Check if admin
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    $isAdmin = false;
    if ($authHeader) {
        try {
            $userId = authenticate($pdo, false); // Don't die on fail
            if ($userId) {
                $role = getUserRole($userId, $pdo);
                if ($role === 'store_manager' || $role === 'super') {
                    $isAdmin = true;
                }
            }
        } catch (Exception $e) {
        }
    }

    try {
        if ($slug) {
            $query = "SELECT * FROM cms_pages WHERE slug = ?";
            if (!$isAdmin) {
                $query .= " AND is_published = 1";
            }
            $stmt = $pdo->prepare($query);
            $stmt->execute([$slug]);
            $page = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($page) {
                sendResponse(true, 'Page fetched successfully', $page);
            } else {
                sendResponse(false, 'Page not found', null, 404);
            }
        } else {
            // Get all summary (usually for admin)
            $query = "SELECT id, slug, title, is_published, updated_at FROM cms_pages";
            if (!$isAdmin && !$all) {
                $query .= " WHERE is_published = 1";
            }
            $query .= " ORDER BY title ASC";

            $stmt = $pdo->prepare($query);
            $stmt->execute();
            $pages = $stmt->fetchAll(PDO::FETCH_ASSOC);
            sendResponse(true, 'Pages fetched successfully', $pages);
        }
    } catch (Exception $e) {
        sendResponse(false, 'Failed to fetch pages: ' . $e->getMessage(), null, 500);
    }
}

// Write Operations (POST/DELETE require Admin auth)
if (!in_array($_SERVER['REQUEST_METHOD'], ['POST', 'DELETE'])) {
    // Non-write methods that weren't handled above (e.g. PUT, PATCH) get a 405
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

try {
    $userId = authenticate($pdo);
    requireRole(['store_manager', 'super'], $pdo);
} catch (Exception $e) {
    sendResponse(false, 'Forbidden: Admins only', null, 403);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $content = trim(file_get_contents("php://input"));
    $decoded = json_decode($content, true);

    if (!is_array($decoded)) {
        sendResponse(false, 'Invalid JSON payload', null, 400);
    }

    $id = $decoded['id'] ?? null;
    $slug = sanitizeInput($decoded['slug'] ?? '');
    $title = sanitizeInput($decoded['title'] ?? '');
    $pageContent = $decoded['content'] ?? '';
    $isPublished = isset($decoded['is_published']) ? (int)$decoded['is_published'] : 0;

    if (empty($slug) || empty($title)) {
        sendResponse(false, 'Slug and Title are required', null, 400);
    }

    try {
        if ($id) {
            $stmt = $pdo->prepare("UPDATE cms_pages SET slug=?, title=?, content=?, is_published=? WHERE id=?");
            $stmt->execute([$slug, $title, $pageContent, $isPublished, $id]);
            logger('info', 'CMS', "Updated page: $title");
            sendResponse(true, 'Page updated');
        } else {
            $stmt = $pdo->prepare("INSERT INTO cms_pages (slug, title, content, is_published) VALUES (?, ?, ?, ?)");
            $stmt->execute([$slug, $title, $pageContent, $isPublished]);
            logger('ok', 'CMS', "Created new page: $title");
            sendResponse(true, 'Page created');
        }
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) { // Duplicate entry
            sendResponse(false, 'A page with this slug already exists', null, 409);
        } else {
            sendDatabaseError($e, 'Unable to save page.');
        }
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) {
        sendResponse(false, 'Page ID required', null, 400);
    }

    try {
        $pdo->prepare("DELETE FROM cms_pages WHERE id = ?")->execute([$id]);
        logger('warning', 'CMS', "Deleted page ID: $id");
        sendResponse(true, 'Page deleted');
    } catch (Exception $e) {
        sendDatabaseError($e, 'Unable to delete page.');
    }
}
