<?php
require_once 'db.php';
require_once 'notifications.php';

header('Content-Type: application/json');

// Authenticate and Require Roles
try {
    // Branch branching logic removed: Only high-tier staff and marketing can mutate products globally.
    $userId = requireRole(['super', 'store_manager', 'marketing'], $pdo);
    $userName = getUserName($userId, $pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized: Authentication failed']);
    exit;
}

// Self-healing: Ensure table and columns exist
if ($config['DB_AUTO_REPAIR'] ?? false) {
    try {
        // Create categories table for centralized category management
        $pdo->exec("CREATE TABLE IF NOT EXISTS categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            slug VARCHAR(100) NOT NULL UNIQUE,
            description TEXT,
            icon VARCHAR(50),
            display_order INT DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_display_order (display_order),
            INDEX idx_is_active (is_active)
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS products (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            price DECIMAL(10, 2) NOT NULL,
            category VARCHAR(100),
            image_url VARCHAR(255),
            stock_quantity INT DEFAULT 0,
            colors JSON,
            specs JSON,
            included JSON,
            directions TEXT,
            product_code VARCHAR(100),
            location VARCHAR(255),
            aisle VARCHAR(50),
            rack VARCHAR(50),
            bin VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");

        $columns = $pdo->query("DESCRIBE products")->fetchAll(PDO::FETCH_COLUMN);
        
        // Ensure new shelving columns exist
        $shelving = ['aisle', 'rack', 'bin'];
        foreach ($shelving as $col) {
            if (!in_array($col, $columns)) {
                $pdo->exec("ALTER TABLE products ADD COLUMN $col VARCHAR(50) AFTER location");
            }
        }

        if (!in_array('directions', $columns)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN directions TEXT AFTER included");
        }
        if (!in_array('included', $columns)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN included JSON AFTER specs");
        }
        if (!in_array('rating', $columns)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN rating DECIMAL(2, 1) DEFAULT 0.0 AFTER directions");
        }
        if (!in_array('gallery', $columns)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN gallery JSON AFTER rating");
        }
        if (!in_array('product_code', $columns)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN product_code VARCHAR(100) AFTER directions");
        }
        if (!in_array('location', $columns)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN location VARCHAR(255) AFTER product_code");
        }
        if (!in_array('discount_percent', $columns)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN discount_percent INT DEFAULT 0 AFTER price");
        }
        if (!in_array('sale_ends_at', $columns)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN sale_ends_at DATETIME DEFAULT NULL AFTER discount_percent");
        }
        if (!in_array('datasheet_url', $columns)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN datasheet_url VARCHAR(500) DEFAULT NULL AFTER sale_ends_at");
        }

        // Performance Indexing
        $indexes = $pdo->query("SHOW INDEX FROM products")->fetchAll(PDO::FETCH_ASSOC);
        $hasCategoryIndex = false;
        foreach ($indexes as $index) {
            if ($index['Key_name'] === 'idx_product_category') {
                $hasCategoryIndex = true;
                break;
            }
        }
        if (!$hasCategoryIndex) {
            $pdo->exec("CREATE INDEX idx_product_category ON products(category)");
        }

        // Normalize empty SKUs and enforce unique product_code when present (multiple NULLs allowed)
        try {
            $pdo->exec("UPDATE products SET product_code = NULL WHERE product_code IS NOT NULL AND TRIM(product_code) = ''");
            $idxRows = $pdo->query("SHOW INDEX FROM products WHERE Key_name = 'uniq_products_product_code'")->fetchAll();
            if (empty($idxRows)) {
                $pdo->exec("CREATE UNIQUE INDEX uniq_products_product_code ON products(product_code)");
            }
        } catch (Exception $e) {
            error_log("Product code unique index skipped: " . $e->getMessage());
        }
    } catch (Exception $e) {
        error_log("Database schema check failed: " . $e->getMessage());
    }
}

/**
 * Empty string → NULL so UNIQUE(product_code) allows multiple unset SKUs.
 */
function normalizeProductCode(?string $code): ?string
{
    if ($code === null) {
        return null;
    }
    $t = trim((string)$code);
    return $t === '' ? null : $t;
}

/**
 * Structured Aisle / Rack / Bin: if any field is set, all three are required.
 * Format: start with alphanumeric, up to 16 chars, internal . _ - allowed (e.g. A1, R2, B03, AA-12).
 */
function validateShelvingComponents(string $aisle, string $rack, string $bin, string $location): ?string
{
    $a = trim((string)$aisle);
    $r = trim((string)$rack);
    $b = trim((string)$bin);
    $loc = trim((string)$location);
    $hasStruct = ($a !== '' || $r !== '' || $b !== '');
    $pattern = '/^[A-Za-z0-9][A-Za-z0-9.\-_]{0,15}$/';
    if ($hasStruct) {
        if ($a === '' || $r === '' || $b === '') {
            return 'Structured shelving requires Aisle, Rack, and Bin (all three). Use free-text Location instead, or fill all three.';
        }
        foreach (['aisle' => $a, 'rack' => $r, 'bin' => $b] as $label => $v) {
            if (!preg_match($pattern, $v)) {
                return "Invalid {$label} format. Use letters/numbers (e.g. A1, R2, B03). Max 16 characters.";
            }
        }
    }
    return null;
}

function assertUniqueProductCode(PDO $pdo, ?string $code, ?int $excludeId = null): ?string
{
    if ($code === null) {
        return null;
    }
    $sql = 'SELECT id FROM products WHERE product_code = ? LIMIT 1';
    $params = [$code];
    if ($excludeId) {
        $sql = 'SELECT id FROM products WHERE product_code = ? AND id != ? LIMIT 1';
        $params = [$code, (int)$excludeId];
    }
    $st = $pdo->prepare($sql);
    $st->execute($params);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        return 'Product code "' . $code . '" is already used by another product.';
    }
    return null;
}

$method = $_SERVER['REQUEST_METHOD'];

/**
 * Helper to save base64 string as a file safely
 */
function saveBase64File(string $base64String, array $allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']): string
{
    if (!$base64String) {
        return $base64String;
    }

    if (strpos($base64String, 'data:') === false) {
        return normalizeLocalPath($base64String);
    }

    $dir = 'uploads/';
    if (!file_exists($dir)) {
        mkdir($dir, 0755, true);
    }

    $parts = explode(',', $base64String);
    if (count($parts) < 2) return $base64String;

    $data = base64_decode($parts[1]);
    if (!$data) return $base64String;

    // Enforce max decoded size (10 MB)
    if (strlen($data) > 10 * 1024 * 1024) {
        error_log('saveBase64File: rejected oversized upload (' . strlen($data) . ' bytes)');
        return $base64String;
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->buffer($data);

    if (!in_array($mimeType, $allowedTypes)) {
        return $base64String;
    }

    $mimeMap = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'application/pdf' => 'pdf'
    ];

    $ext = $mimeMap[$mimeType] ?? 'bin';
    $filename = 'file_' . bin2hex(random_bytes(8)) . '.' . $ext;
    $filepath = $dir . $filename;

    if (file_put_contents($filepath, $data)) {
        return $filepath;
    }

    return $base64String;
}

if ($method === 'POST') {
    $content = trim(file_get_contents("php://input"));
    $decoded = json_decode($content, true);

    if (!is_array($decoded)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON payload']);
        exit;
    }

    $action = $decoded['action'] ?? '';

    if ($action === 'bulk_shelving') {
        $ids = $decoded['product_ids'] ?? [];
        if (!is_array($ids) || empty($ids)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'product_ids array is required']);
            exit;
        }
        $aisle = sanitizeInput($decoded['aisle'] ?? '');
        $rack = sanitizeInput($decoded['rack'] ?? '');
        $bin = sanitizeInput($decoded['bin'] ?? '');
        $location = sanitizeInput($decoded['location'] ?? '');
        $sErr = validateShelvingComponents($aisle, $rack, $bin, $location);
        if ($sErr) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $sErr]);
            exit;
        }
        $ids = array_values(array_unique(array_map('intval', $ids)));
        $ids = array_filter($ids, function ($pid) {
            return $pid > 0;
        });
        if (empty($ids)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No valid product IDs']);
            exit;
        }
        try {
            $pdo->beginTransaction();
            
            // Lock all product rows to prevent race conditions with concurrent updates
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $lockStmt = $pdo->prepare("SELECT id FROM products WHERE id IN ($placeholders) FOR UPDATE");
            $lockStmt->execute($ids);
            
            $stmt = $pdo->prepare("UPDATE products SET aisle = ?, rack = ?, bin = ?, location = ? WHERE id IN ($placeholders)");
            $stmt->execute(array_merge([$aisle, $rack, $bin, $location], $ids));
            $updated = $stmt->rowCount();
            
            $pdo->commit();
            
            logger('info', 'PRODUCTS', "Bulk shelving update for " . count($ids) . " products by {$userName}");
            logAdminAudit($pdo, $userId, 'product.bulk_shelving', 'product', implode(',', $ids), [
                'aisle' => $aisle, 'rack' => $rack, 'bin' => $bin, 'location' => $location,
            ]);
            echo json_encode(['success' => true, 'updated' => $updated]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Bulk update failed']);
        }
        exit;
    }
    
    $name = sanitizeInput($decoded['name'] ?? '');
    $category = sanitizeInput($decoded['category'] ?? '');
    if (empty($category)) $category = 'Gadgets';
    $price = max(0, (float)($decoded['price'] ?? 0));
    $stock = max(0, (int)($decoded['stock'] ?? 0));
    $rating = (float)($decoded['rating'] ?? 0.0);
    $description = sanitizeInput($decoded['description'] ?? '');
    $image_data = $decoded['image'] ?? '';
    $colors = $decoded['colors'] ?? '[]';
    $specs = $decoded['specs'] ?? '{}';
    $included = $decoded['included'] ?? '[]';
    $directions = $decoded['directions'] ?? '';
    $product_code = normalizeProductCode(sanitizeInput($decoded['product_code'] ?? ''));
    $location = sanitizeInput($decoded['location'] ?? '');
    $aisle = sanitizeInput($decoded['aisle'] ?? '');
    $rack = sanitizeInput($decoded['rack'] ?? '');
    $bin = sanitizeInput($decoded['bin'] ?? '');
    $shelvingErr = validateShelvingComponents($aisle, $rack, $bin, $location);
    if ($shelvingErr) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $shelvingErr]);
        exit;
    }
    $gallery_input = $decoded['gallery'] ?? [];
    $variants = $decoded['variants'] ?? [];
    $discount_percent = max(0, min(100, (int)($decoded['discount_percent'] ?? 0)));
    $datasheet_url = sanitizeInput($decoded['datasheet_url'] ?? '');
    
    $sale_ends_at = null;
    if (!empty($decoded['sale_ends_at'])) {
        $raw_date = str_replace('T', ' ', sanitizeInput($decoded['sale_ends_at']));
        if (strlen($raw_date) === 16) $raw_date .= ':00';
        $sale_ends_at = $raw_date;
    }

    if ($action === 'create') {
        $image_url = saveBase64File($image_data, ['image/jpeg', 'image/png', 'image/webp']);
        $directions_url = saveBase64File($directions, ['application/pdf']);

        $gallery_urls = [];
        if (is_array($gallery_input)) {
            foreach ($gallery_input as $img) {
                if ($img) $gallery_urls[] = saveBase64File($img, ['image/jpeg', 'image/png', 'image/webp']);
            }
        }
        $gallery_json = json_encode($gallery_urls);

        if (!$name || !$category) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Missing required fields']);
            exit;
        }

        $dupErr = assertUniqueProductCode($pdo, $product_code, null);
        if ($dupErr) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => $dupErr]);
            exit;
        }

        try {
            $pdo->beginTransaction();
            $status = ($stock > 0) ? 'active' : 'out_of_stock';
            $stmt = $pdo->prepare("INSERT INTO products (name, category, price, discount_percent, sale_ends_at, datasheet_url, stock_quantity, rating, description, image_url, gallery, colors, specs, included, directions, product_code, location, aisle, rack, bin, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$name, $category, $price, $discount_percent, $sale_ends_at, $datasheet_url, $stock, $rating, $description, $image_url, $gallery_json, $colors, $specs, $included, $directions_url, $product_code, $location, $aisle, $rack, $bin, $status]);
            $productId = $pdo->lastInsertId();

            if (is_array($variants)) {
                $varStmt = $pdo->prepare("INSERT INTO product_variants (product_id, sku, attributes, price_modifier, stock_quantity, image_url) VALUES (?, ?, ?, ?, ?, ?)");
                foreach ($variants as $v) {
                    $attr = is_string($v['attributes']) ? $v['attributes'] : json_encode($v['attributes'] ?? []);
                    $varStmt->execute([$productId, sanitizeInput($v['sku'] ?? ''), $attr, (float)($v['price_modifier'] ?? 0), (int)($v['stock_quantity'] ?? 0), sanitizeInput($v['image_url'] ?? '')]);
                }
            }

            $pdo->commit();
            
            if ($stock < 10) {
                $throttleStmt = $pdo->prepare("SELECT id FROM notifications WHERE title = ? AND created_at >= NOW() - INTERVAL 1 DAY LIMIT 1");
                $throttleStmt->execute(["Low Stock Alert: {$name}"]);
                if (!$throttleStmt->fetchColumn()) {
                    $notifService = new NotificationService();
                    $notifService->logAdminNotification("Low Stock Alert: {$name}", "Product '{$name}' is running low (Current: {$stock}).", 'system');
                }
            }

            logger('info', 'PRODUCTS', "New product created: {$name} (ID: {$productId}) by {$userName}");
            logAdminAudit($pdo, $userId, 'product.create', 'product', (string)$productId, [
                'name' => $name,
                'product_code' => $product_code,
                'price' => $price,
                'stock' => $stock,
                'location' => $location,
                'aisle' => $aisle,
                'rack' => $rack,
                'bin' => $bin
            ]);
            echo json_encode(['success' => true, 'id' => $productId, 'image_url' => $image_url]);
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log("Product creation failed: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to create product.']);
        }
    } elseif ($action === 'update') {
        $id = (int)($decoded['id'] ?? 0);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Product ID is required']);
            exit;
        }

        $image_url = saveBase64File($image_data, ['image/jpeg', 'image/png', 'image/webp']);
        $directions_url = saveBase64File($directions, ['application/pdf']);

        $gallery_urls = [];
        if (is_array($gallery_input)) {
            foreach ($gallery_input as $img) {
                if ($img) $gallery_urls[] = saveBase64File($img, ['image/jpeg', 'image/png', 'image/webp']);
            }
        }
        $gallery_json = json_encode($gallery_urls);

        $dupErr = assertUniqueProductCode($pdo, $product_code, $id);
        if ($dupErr) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => $dupErr]);
            exit;
        }

        try {
            $stmt = $pdo->prepare("SELECT image_url, gallery, directions, version FROM products WHERE id = ?");
            $stmt->execute([$id]);
            $oldProduct = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$oldProduct) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Product not found']);
                exit;
            }

            $pdo->beginTransaction();
            // Manual status sync during update
            $newStatus = ($stock > 0) ? 'active' : 'out_of_stock';
            $stmt = $pdo->prepare("UPDATE products SET name = ?, category = ?, price = ?, discount_percent = ?, sale_ends_at = ?, datasheet_url = ?, stock_quantity = ?, rating = ?, description = ?, image_url = ?, gallery = ?, colors = ?, specs = ?, included = ?, directions = ?, product_code = ?, location = ?, aisle = ?, rack = ?, bin = ?, status = ?, version = version + 1 WHERE id = ? AND version = ?");
            $stmt->execute([$name, $category, $price, $discount_percent, $sale_ends_at, $datasheet_url, $stock, $rating, $description, $image_url, $gallery_json, $colors, $specs, $included, $directions_url, $product_code, $location, $aisle, $rack, $bin, $newStatus, $id, $oldProduct['version']]);
            
            if ($stmt->rowCount() === 0) {
                $pdo->rollBack();
                http_response_code(409);
                echo json_encode(['success' => false, 'error' => 'Product was modified by another user. Please refresh and try again.']);
                exit;
            }

            if ($oldProduct) {
                $uploadsDir = realpath(__DIR__ . '/uploads');

                $safeUnlink = function(?string $path) use ($uploadsDir): void {
                    if (!$path) return;
                    $real = realpath($path);
                    if ($real && $uploadsDir && str_starts_with($real, $uploadsDir) && is_file($real)) {
                        unlink($real);
                    }
                };

                if ($image_url !== $oldProduct['image_url']) $safeUnlink($oldProduct['image_url']);
                if ($directions_url !== $oldProduct['directions']) $safeUnlink($oldProduct['directions']);
                
                $oldGallery = json_decode($oldProduct['gallery'] ?? '[]', true);
                $newGallery = json_decode($gallery_json, true);
                if (is_array($oldGallery) && is_array($newGallery)) {
                    foreach ($oldGallery as $oldImg) {
                        if ($oldImg && !in_array($oldImg, $newGallery)) $safeUnlink($oldImg);
                    }
                }
            }

            if (is_array($variants)) {
                $pdo->prepare("DELETE FROM product_variants WHERE product_id = ?")->execute([$id]);
                $varStmt = $pdo->prepare("INSERT INTO product_variants (product_id, sku, attributes, price_modifier, stock_quantity, image_url) VALUES (?, ?, ?, ?, ?, ?)");
                foreach ($variants as $v) {
                    $attr = is_string($v['attributes']) ? $v['attributes'] : json_encode($v['attributes'] ?? []);
                    $varStmt->execute([$id, sanitizeInput($v['sku'] ?? ''), $attr, (float)($v['price_modifier'] ?? 0), (int)($v['stock_quantity'] ?? 0), sanitizeInput($v['image_url'] ?? '')]);
                }
            }

            $pdo->commit();
            
            logger('info', 'PRODUCTS', "Product updated (ID: {$id}) by {$userName}");
            logAdminAudit($pdo, $userId, 'product.update', 'product', (string)$id, [
                'name' => $name,
                'product_code' => $product_code,
                'price' => $price,
                'stock' => $stock,
                'location' => $location,
                'aisle' => $aisle,
                'rack' => $rack,
                'bin' => $bin
            ]);
            echo json_encode(['success' => true, 'image_url' => $image_url]);
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log("Product update failed: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to update product.']);
        }
    } elseif ($action === 'delete') {
        $role = getUserRole($userId, $pdo);
        if ($role === 'marketing') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Permission denied. Marketing role cannot delete products.']);
            exit;
        }
        $id = (int)($decoded['id'] ?? 0);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Product ID is required']);
            exit;
        }

        try {
            // Check if product is tied to any historical orders
            $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM order_items WHERE product_id = ?");
            $checkStmt->execute([$id]);
            $orderCount = (int)$checkStmt->fetchColumn();

            $stmt = $pdo->prepare("SELECT image_url, gallery, directions FROM products WHERE id = ?");
            $stmt->execute([$id]);
            $product = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($orderCount === 0) {
                // SCENARIO A: No orders -> Full Hard Delete + Server Wipe
                if ($product) {
                    $uploadsDir = realpath(__DIR__ . '/uploads');
                    $safeUnlink = function(?string $path) use ($uploadsDir): void {
                        if (!$path) return;
                        $real = realpath($path);
                        if ($real && $uploadsDir && str_starts_with($real, $uploadsDir) && is_file($real)) unlink($real);
                    };

                    $filesToDelete = [$product['image_url'], $product['directions']];
                    $gallery = json_decode($product['gallery'] ?? '[]', true);
                    if (is_array($gallery)) $filesToDelete = array_merge($filesToDelete, $gallery);
                    foreach ($filesToDelete as $file) {
                        $safeUnlink($file);
                    }
                }
                $pdo->prepare("DELETE FROM products WHERE id = ?")->execute([$id]);
                logger('warn', 'PRODUCTS', "Product hard-deleted (ID: {$id}) by {$userName} - No historical orders found.");
                logAdminAudit($pdo, $userId, 'product.hard_delete', 'product', (string)$id, []);
                echo json_encode(['success' => true, 'message' => 'Product and all files securely deleted.']);

            } else {
                // SCENARIO B: Has orders -> Soft Delete (Archive) + Media Pruning
                $uploadsDir = realpath(__DIR__ . '/uploads');
                $safeUnlink = function(?string $path) use ($uploadsDir): void {
                    if (!$path) return;
                    $real = realpath($path);
                    if ($real && $uploadsDir && str_starts_with($real, $uploadsDir) && is_file($real)) unlink($real);
                };
                if ($product) {
                    $filesToPrune = [$product['directions']];
                    $gallery = json_decode($product['gallery'] ?? '[]', true);
                    if (is_array($gallery)) $filesToPrune = array_merge($filesToPrune, $gallery);
                    foreach ($filesToPrune as $file) {
                        $safeUnlink($file);
                    }
                }
                // Keep image_url for history, clear gallery/directions to save DB space
                $pdo->prepare("UPDATE products SET status = 'archived', gallery = '[]', directions = NULL WHERE id = ?")->execute([$id]);
                logger('warn', 'PRODUCTS', "Product archived/soft-deleted with media pruning (ID: {$id}) by {$userName}");
                logAdminAudit($pdo, $userId, 'product.archive', 'product', (string)$id, ['status' => 'archived', 'pruned' => true]);
                echo json_encode(['success' => true, 'message' => 'Product archived. Gallery and manuals pruned to save storage.']);
            }
        } catch (PDOException $e) {
            error_log("Product deletion failed: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to delete product.']);
        }
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
