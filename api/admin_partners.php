<?php
// backend/admin_partners.php
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

// Self-healing: Ensure table exists
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS partners (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        logo_url LONGTEXT NOT NULL,
        display_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
} catch (Exception $e) {
    // Silently continue
}

/**
 * Helper to save base64 image string as a partner logo file
 */
if (!function_exists('saveBase64PartnerLogo')) {
    function saveBase64PartnerLogo(string $base64String): string
    {
        if (!$base64String || strpos($base64String, 'data:image') === false) {
            return normalizeLocalPath($base64String);
        }

        $dir = 'uploads/partners/';
        if (!file_exists($dir)) {
            mkdir($dir, 0777, true);
        }

        $parts = explode(',', $base64String);
        if (count($parts) < 2) return $base64String;

        $header = $parts[0];
        $data = base64_decode($parts[1]);

        preg_match('/image\/([a-z+]+);/', $header, $matches);
        $ext = $matches[1] ?? 'png';
        $ext = ($ext === 'jpeg') ? 'jpg' : $ext;

        $filename = 'logo_' . uniqid() . '.' . $ext;
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
        // Fetch All Partners (including inactive)
        $stmt = $pdo->prepare("SELECT * FROM partners ORDER BY display_order ASC, created_at ASC");
        $stmt->execute();
        $partners = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'data' => $partners]);
    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents("php://input"), true);

        $action = $data['action'] ?? 'create';

        if ($action === 'create') {
            $logo_url = saveBase64PartnerLogo($data['logo_url'] ?? '');
            $stmt = $pdo->prepare("INSERT INTO partners (name, logo_url, display_order, is_active) VALUES (?, ?, ?, ?)");
            $stmt->execute([
                sanitizeInput($data['name']),
                $logo_url,
                (int)$data['display_order'],
                isset($data['is_active']) ? (int)$data['is_active'] : 1
            ]);
            $newId = $pdo->lastInsertId();
            logger('info', 'APPEARANCE', "New partner created (ID: {$newId}) by {$userName}");
            echo json_encode(['success' => true, 'id' => $newId]);
        } elseif ($action === 'update') {
            $id = $data['id'];

            // Fetch old logo path before update for cleanup
            $stmt = $pdo->prepare("SELECT logo_url FROM partners WHERE id = ?");
            $stmt->execute([$id]);
            $oldLogoUrl = $stmt->fetchColumn();

            $logo_url = saveBase64PartnerLogo($data['logo_url'] ?? '');
            $stmt = $pdo->prepare("UPDATE partners SET name=?, logo_url=?, display_order=?, is_active=? WHERE id=?");
            $stmt->execute([
                sanitizeInput($data['name']),
                $logo_url,
                (int)$data['display_order'],
                (int)$data['is_active'],
                $id
            ]);

            // Cleanup old logo file if it was replaced and is a local file
            if ($oldLogoUrl && $logo_url !== $oldLogoUrl && file_exists($oldLogoUrl) && is_file($oldLogoUrl)) {
                unlink($oldLogoUrl);
            }

            logger('info', 'APPEARANCE', "Partner updated (ID: {$id}) by {$userName}");
            echo json_encode(['success' => true]);
        } elseif ($action === 'delete') {
            $id = $data['id'];

            // Fetch logo path before deletion for cleanup
            $stmt = $pdo->prepare("SELECT logo_url FROM partners WHERE id=?");
            $stmt->execute([$id]);
            $logoUrl = $stmt->fetchColumn();

            if ($logoUrl && file_exists($logoUrl) && is_file($logoUrl)) {
                unlink($logoUrl);
            }

            $stmt = $pdo->prepare("DELETE FROM partners WHERE id=?");
            $stmt->execute([$id]);

            logger('warn', 'APPEARANCE', "Partner deleted (ID: {$id}) by {$userName}");
            echo json_encode(['success' => true]);
        } elseif ($action === 'upload') {
            if (!isset($_FILES['logo'])) {
                throw new Exception('No logo file uploaded');
            }

            $file = $_FILES['logo'];
            $uploadDir = __DIR__ . '/uploads/partners/';
            if (!file_exists($uploadDir)) mkdir($uploadDir, 0777, true);

            $filename = uniqid('logo_') . '.' . pathinfo($file['name'], PATHINFO_EXTENSION);
            $targetPath = $uploadDir . $filename;

            if (move_uploaded_file($file['tmp_name'], $targetPath)) {
                $publicUrl = "uploads/partners/" . $filename;
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
