<?php
// backend/admin_slider.php
require 'cors_middleware.php';
require 'db.php';
require 'security.php';

header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// Authenticate and Require Roles
try {
    $userId = requireRole(['store_manager', 'marketing'], $pdo);
    $userName = getUserName($userId, $pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
}

// Self-healing: Ensure table and columns exist
if ($config['DB_AUTO_REPAIR'] ?? false) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS slider_images (
            id INT AUTO_INCREMENT PRIMARY KEY,
            image_url LONGTEXT NOT NULL,
            title VARCHAR(255),
            subtitle VARCHAR(255),
            button_text VARCHAR(50),
            button_link VARCHAR(255),
            text_position VARCHAR(20) DEFAULT 'left',
            content_blocks LONGTEXT,
            display_order INT DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");

        $columns = $pdo->query("DESCRIBE slider_images")->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('text_position', $columns)) {
            $pdo->exec("ALTER TABLE slider_images ADD COLUMN text_position VARCHAR(20) DEFAULT 'left' AFTER button_link");
        }
        if (!in_array('content_blocks', $columns)) {
            $pdo->exec("ALTER TABLE slider_images ADD COLUMN content_blocks LONGTEXT AFTER text_position");
        }
        $pdo->exec("ALTER TABLE slider_images MODIFY COLUMN image_url LONGTEXT NOT NULL");
    } catch (Exception $e) {
        // Silently continue if possible, or handle error
    }
}

/**
 * Helper to save base64 image string as a file
 */
if (!function_exists('saveBase64Image')) {
    function saveBase64Image(string $base64String): string
    {
        if (!$base64String || (strpos($base64String, 'data:image') === false && strpos($base64String, 'data:video') === false)) {
            return normalizeLocalPath($base64String);
        }

        $dir = 'uploads/slider/';
        if (!file_exists($dir)) {
            mkdir($dir, 0777, true);
        }

        $parts = explode(',', $base64String);
        if (count($parts) < 2) return $base64String;

        $header = $parts[0];
        $data = base64_decode($parts[1]);

        preg_match('/(?:image|video)\/([a-z0-9+-]+);/', $header, $matches);
        $ext = $matches[1] ?? 'png';
        $ext = ($ext === 'jpeg') ? 'jpg' : $ext;

        $filename = 'slide_' . uniqid() . '.' . $ext;
        $filepath = $dir . $filename;

        if (file_put_contents($filepath, $data)) {
            return $filepath;
        }

        return $base64String;
    }
}

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        // Fetch All Slides (including inactive)
        $stmt = $pdo->prepare("SELECT * FROM slider_images ORDER BY display_order ASC, created_at ASC");
        $stmt->execute();
        $slides = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'data' => $slides]);
    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents("php://input"), true);

        $action = $data['action'] ?? 'create';

        if ($action === 'create') {
            $image_url = saveBase64Image($data['image_url'] ?? '');
            $content_blocks = isset($data['content_blocks']) ? json_encode($data['content_blocks']) : '[]';
            $stmt = $pdo->prepare("INSERT INTO slider_images (image_url, title, subtitle, button_text, button_link, text_position, content_blocks, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $image_url,
                sanitizeInput($data['title']),
                sanitizeInput($data['subtitle']),
                sanitizeInput($data['button_text']),
                sanitizeInput($data['button_link']),
                sanitizeInput($data['text_position'] ?? 'left'),
                $content_blocks,
                (int)$data['display_order'],
                isset($data['is_active']) ? (int)$data['is_active'] : 1
            ]);
            $newId = $pdo->lastInsertId();
            logger('info', 'APPEARANCE', "New hero slide created (ID: {$newId}) by {$userName}");
            echo json_encode(['success' => true, 'id' => $newId]);
        } elseif ($action === 'update') {
            $id = $data['id'];

            // Fetch old image path before update
            $stmt = $pdo->prepare("SELECT image_url FROM slider_images WHERE id = ?");
            $stmt->execute([$id]);
            $oldImageUrl = $stmt->fetchColumn();

            $image_url = saveBase64Image($data['image_url'] ?? '');
            $content_blocks = isset($data['content_blocks']) ? json_encode($data['content_blocks']) : '[]';
            $stmt = $pdo->prepare("UPDATE slider_images SET image_url=?, title=?, subtitle=?, button_text=?, button_link=?, text_position=?, content_blocks=?, display_order=?, is_active=? WHERE id=?");
            $stmt->execute([
                $image_url,
                sanitizeInput($data['title']),
                sanitizeInput($data['subtitle']),
                sanitizeInput($data['button_text']),
                sanitizeInput($data['button_link']),
                sanitizeInput($data['text_position'] ?? 'left'),
                $content_blocks,
                (int)$data['display_order'],
                (int)$data['is_active'],
                $id
            ]);

            // Cleanup old image if it was replaced
            if ($oldImageUrl && $image_url !== $oldImageUrl && file_exists($oldImageUrl) && is_file($oldImageUrl)) {
                unlink($oldImageUrl);
            }

            logger('info', 'APPEARANCE', "Hero slide updated (ID: {$id}) by {$userName}");
            echo json_encode(['success' => true]);
        } elseif ($action === 'delete') {
            $id = $data['id'];

            // Fetch image path before deletion
            $stmt = $pdo->prepare("SELECT image_url FROM slider_images WHERE id=?");
            $stmt->execute([$id]);
            $imageUrl = $stmt->fetchColumn();

            if ($imageUrl && file_exists($imageUrl) && is_file($imageUrl)) {
                unlink($imageUrl);
            }

            $stmt = $pdo->prepare("DELETE FROM slider_images WHERE id=?");
            $stmt->execute([$id]);

            logger('warn', 'APPEARANCE', "Hero slide deleted (ID: {$id}) by {$userName}");
            echo json_encode(['success' => true]);
        } elseif ($action === 'upload') {
            // Handle file upload
            if (!isset($_FILES['image'])) {
                throw new Exception('No file uploaded');
            }

            $file = $_FILES['image'];
            $uploadDir = __DIR__ . '/uploads/slider/';
            if (!file_exists($uploadDir)) mkdir($uploadDir, 0777, true);

            $filename = uniqid('slide_') . '.' . pathinfo($file['name'], PATHINFO_EXTENSION);
            $targetPath = $uploadDir . $filename;

            if (move_uploaded_file($file['tmp_name'], $targetPath)) {
                $publicUrl = "uploads/slider/" . $filename;
                echo json_encode(['success' => true, 'url' => $publicUrl]);
            } else {
                throw new Exception('Failed to move uploaded file');
            }
        }
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
