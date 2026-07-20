<?php
/**
 * Batch API Endpoint
 * Fetch multiple resources in a single request (WordPress alloptions style)
 *
 * POST /batch.php
 * Body: { "resources": ["products", "categories", "settings", "notifications"] }
 */

require 'db.php';
require 'cache.php';
require 'cors_middleware.php';
require 'security.php';
header('Content-Type: application/json');

$body = json_decode(file_get_contents('php://input'), true);
$requestedResources = $body['resources'] ?? [];

// Validate that resources is an array
if (!is_array($requestedResources)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid resources format']);
    exit;
}

// Validate each resource name
$validResources = ['products', 'categories', 'settings', 'notifications', 'branding', 'orders', 'users', 'logs', 'reviews', 'admin_messages', 'staff_users', 'backups'];
$requestedResources = array_filter($requestedResources, function($resource) use ($validResources) {
    return in_array($resource, $validResources, true);
});

if (empty($requestedResources)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'No resources requested']);
    exit;
}

$response = [
    'success' => true,
    'data' => []
];

// Products
if (in_array('products', $requestedResources)) {
    try {
        require_once 'inventory_utils.php';
        lazyCancelOrders($pdo);
        
        $stmt = $pdo->query("
            SELECT p.*, 
                   p.stock_quantity as physical_stock,
                   (p.stock_quantity - (
                       SELECT IFNULL(SUM(oi.quantity), 0)
                       FROM order_items oi
                       JOIN orders o ON oi.order_id = o.id
                       WHERE oi.product_id = p.id
                       AND o.status = 'pending'
                       AND (
                           (p.stock_quantity < 10 AND COALESCE(o.reserved_at, o.created_at) >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 MINUTE))
                           OR
                           (p.stock_quantity >= 10 AND COALESCE(o.reserved_at, o.created_at) >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 20 MINUTE))
                       )
                   )) as stock_quantity
            FROM products p 
            WHERE p.status IN ('active', 'out_of_stock')
            ORDER BY p.created_at DESC
        ");
        $products = $stmt->fetchAll();
        
        $productIds = array_column($products, 'id');
        $variantsByProduct = [];
        if (!empty($productIds)) {
            $inQuery = implode(',', array_fill(0, count($productIds), '?'));
            $varStmt = $pdo->prepare("SELECT * FROM product_variants WHERE product_id IN ($inQuery)");
            $varStmt->execute($productIds);
            while ($v = $varStmt->fetch(PDO::FETCH_ASSOC)) {
                $v['attributes'] = json_decode($v['attributes'] ?? '[]', true);
                $v['price_modifier'] = (float)$v['price_modifier'];
                $v['stock_quantity'] = (int)$v['stock_quantity'];
                $variantsByProduct[$v['product_id']][] = $v;
            }
        }
        
        foreach ($products as &$product) {
            $product['colors'] = json_decode($product['colors'] ?? '[]', true);
            $product['specs'] = json_decode($product['specs'] ?? '{}', true);
            $product['included'] = json_decode($product['included'] ?? '[]', true);
            $product['gallery'] = json_decode($product['gallery'] ?? '[]', true);
            $product['price'] = (float)$product['price'];
            $product['rating'] = (float)($product['rating'] ?? 0);
            $product['variants'] = $variantsByProduct[$product['id']] ?? [];
        }
        
        $response['data']['products'] = $products;
    } catch (Exception $e) {
        $response['data']['products'] = [];
        $response['errors']['products'] = $e->getMessage();
    }
}

// Categories
if (in_array('categories', $requestedResources)) {
    try {
        $stmt = $pdo->query("SELECT * FROM categories ORDER BY name ASC");
        $categories = $stmt->fetchAll();
        $response['data']['categories'] = $categories;
    } catch (Exception $e) {
        $response['data']['categories'] = [];
        $response['errors']['categories'] = $e->getMessage();
    }
}

// Settings
if (in_array('settings', $requestedResources)) {
    try {
        require_once 'brand_settings.php';
        $settings = eh_merged_super_settings();
        $response['data']['settings'] = $settings;
    } catch (Exception $e) {
        $response['data']['settings'] = [];
        $response['errors']['settings'] = $e->getMessage();
        error_log('Batch settings error: ' . $e->getMessage());
    }
}

// Notifications
if (in_array('notifications', $requestedResources)) {
    try {
        $userId = authenticate($pdo, false);
        if ($userId) {
            $stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20");
            $stmt->execute([$userId]);
            $notifications = $stmt->fetchAll();
            $response['data']['notifications'] = $notifications;
        } else {
            $response['data']['notifications'] = [];
        }
    } catch (Exception $e) {
        $response['data']['notifications'] = [];
        $response['errors']['notifications'] = $e->getMessage();
    }
}

// Orders
if (in_array('orders', $requestedResources)) {
    try {
        $userId = authenticate($pdo, false);
        if ($userId) {
            $stmt = $pdo->prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50");
            $stmt->execute([$userId]);
            $orders = $stmt->fetchAll();
            $response['data']['orders'] = $orders;
        } else {
            $response['data']['orders'] = [];
        }
    } catch (Exception $e) {
        $response['data']['orders'] = [];
        $response['errors']['orders'] = $e->getMessage();
    }
}

// Users (admin only)
if (in_array('users', $requestedResources)) {
    try {
        $userId = authenticate($pdo, false);
        if ($userId) {
            $stmt = $pdo->query("SELECT id, name, email, phone, role, level, level_name, created_at FROM users ORDER BY created_at DESC");
            $users = $stmt->fetchAll();
            $response['data']['users'] = $users;
        } else {
            $response['data']['users'] = [];
            $response['errors']['users'] = 'Unauthorized';
        }
    } catch (Exception $e) {
        $response['data']['users'] = [];
        $response['errors']['users'] = $e->getMessage();
    }
}

// System Logs (admin only)
if (in_array('logs', $requestedResources)) {
    try {
        $userId = authenticate($pdo, false);
        if ($userId) {
            $stmt = $pdo->query("SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 100");
            $logs = $stmt->fetchAll();
            $response['data']['logs'] = $logs;
        } else {
            $response['data']['logs'] = [];
            $response['errors']['logs'] = 'Unauthorized';
        }
    } catch (Exception $e) {
        $response['data']['logs'] = [];
        $response['errors']['logs'] = $e->getMessage();
    }
}

// Reviews
if (in_array('reviews', $requestedResources)) {
    try {
        $stmt = $pdo->query("SELECT r.*, p.name as product_name FROM reviews r JOIN products p ON r.product_id = p.id ORDER BY r.created_at DESC LIMIT 50");
        $reviews = $stmt->fetchAll();
        $response['data']['reviews'] = $reviews;
    } catch (Exception $e) {
        $response['data']['reviews'] = [];
        $response['errors']['reviews'] = $e->getMessage();
    }
}

// Admin Messages (admin only)
if (in_array('admin_messages', $requestedResources)) {
    try {
        $userId = authenticate($pdo, false);
        if ($userId) {
            // Get global messages
            $stmt = $pdo->prepare("
                SELECT m.*, u.name as sender_name, u.avatar_text, u.profile_image, 
                       p.name as pinner_name, r.message as reply_to_message, ru.name as reply_to_name
                FROM admin_messages m 
                JOIN users u ON m.sender_id = u.id 
                LEFT JOIN users p ON m.pinned_by = p.id
                LEFT JOIN admin_messages r ON m.reply_to_id = r.id
                LEFT JOIN users ru ON r.sender_id = ru.id
                WHERE m.receiver_id IS NULL 
                ORDER BY m.created_at ASC
                LIMIT 100
            ");
            $stmt->execute();
            $messages = $stmt->fetchAll();
            $response['data']['admin_messages'] = $messages;
        } else {
            $response['data']['admin_messages'] = [];
            $response['errors']['admin_messages'] = 'Unauthorized';
        }
    } catch (Exception $e) {
        $response['data']['admin_messages'] = [];
        $response['errors']['admin_messages'] = $e->getMessage();
    }
}

// Staff Users (admin only)
if (in_array('staff_users', $requestedResources)) {
    try {
        $userId = authenticate($pdo, false);
        if ($userId) {
            $stmt = $pdo->query("SELECT id, name, email, phone, role, level, level_name, avatar_text, profile_image, created_at FROM users WHERE role IN ('admin', 'staff', 'picker', 'store_manager', 'super') ORDER BY name ASC");
            $staff = $stmt->fetchAll();
            $response['data']['staff_users'] = $staff;
        } else {
            $response['data']['staff_users'] = [];
            $response['errors']['staff_users'] = 'Unauthorized';
        }
    } catch (Exception $e) {
        $response['data']['staff_users'] = [];
        $response['errors']['staff_users'] = $e->getMessage();
    }
}

// Backups (admin only)
if (in_array('backups', $requestedResources)) {
    try {
        $userId = authenticate($pdo, false);
        if ($userId) {
            $backupDir = __DIR__ . '/backups';
            $backups = [];
            if (is_dir($backupDir)) {
                $files = scandir($backupDir);
                foreach ($files as $file) {
                    if ($file !== '.' && $file !== '..' && str_ends_with($file, '.sql')) {
                        $filePath = $backupDir . '/' . $file;
                        $backups[] = [
                            'filename' => $file,
                            'size' => filesize($filePath),
                            'created_at' => date('Y-m-d H:i:s', filemtime($filePath))
                        ];
                    }
                }
            }
            usort($backups, fn($a, $b) => strtotime($b['created_at']) - strtotime($a['created_at']));
            $response['data']['backups'] = $backups;
        } else {
            $response['data']['backups'] = [];
            $response['errors']['backups'] = 'Unauthorized';
        }
    } catch (Exception $e) {
        $response['data']['backups'] = [];
        $response['errors']['backups'] = $e->getMessage();
    }
}

echo json_encode($response);
