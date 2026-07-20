<?php
require_once 'db.php';
require_once 'security.php';

header('Content-Type: application/json');

/**
 * Inventory by Location API
 * Provides real-time inventory visibility across pickup locations
 * Reduces friction by letting customers know which locations have items in stock
 */

// Self-heal schema for location-based inventory
$pdo->exec("CREATE TABLE IF NOT EXISTS inventory_by_location (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    pickup_location_id INT NOT NULL,
    stock_quantity INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (pickup_location_id) REFERENCES pickup_locations(id) ON DELETE CASCADE,
    UNIQUE KEY unique_product_location (product_id, pickup_location_id),
    INDEX idx_location_stock (pickup_location_id, stock_quantity)
)");

try {
    $userId = authenticate($pdo);
} catch (Exception $e) {
    // Allow public access for inventory checking
    $userId = null;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $productId = (int)($_GET['product_id'] ?? 0);
    $locationId = (int)($_GET['location_id'] ?? 0);
    
    if ($productId > 0 && $locationId > 0) {
        // Check specific product at specific location
        $stmt = $pdo->prepare("
            SELECT ibl.stock_quantity, ibl.last_updated,
                   p.name as product_name, p.stock_quantity as total_stock,
                   pl.name as location_name, pl.address as location_address
            FROM inventory_by_location ibl
            JOIN products p ON ibl.product_id = p.id
            JOIN pickup_locations pl ON ibl.pickup_location_id = pl.id
            WHERE ibl.product_id = ? AND ibl.pickup_location_id = ? AND pl.is_active = 1
        ");
        $stmt->execute([$productId, $locationId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$result) {
            // Fallback to total stock if location-specific not found
            $fallbackStmt = $pdo->prepare("SELECT name, stock_quantity FROM products WHERE id = ?");
            $fallbackStmt->execute([$productId]);
            $product = $fallbackStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($product) {
                echo json_encode([
                    'success' => true,
                    'data' => [
                        'product_id' => $productId,
                        'location_id' => $locationId,
                        'stock_quantity' => $product['stock_quantity'], // Use total as fallback
                        'is_location_specific' => false,
                        'product_name' => $product['name']
                    ]
                ]);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Product not found']);
            }
        } else {
            echo json_encode([
                'success' => true,
                'data' => [
                    'product_id' => $productId,
                    'location_id' => $locationId,
                    'stock_quantity' => (int)$result['stock_quantity'],
                    'last_updated' => $result['last_updated'],
                    'is_location_specific' => true,
                    'product_name' => $result['product_name'],
                    'location_name' => $result['location_name'],
                    'location_address' => $result['location_address'],
                    'total_stock' => (int)$result['total_stock']
                ]
            ]);
        }
    } elseif ($productId > 0) {
        // Check product availability across all locations
        $stmt = $pdo->prepare("
            SELECT ibl.pickup_location_id, ibl.stock_quantity, ibl.last_updated,
                   pl.name as location_name, pl.address as location_address, pl.city,
                   p.stock_quantity as total_stock
            FROM inventory_by_location ibl
            JOIN pickup_locations pl ON ibl.pickup_location_id = pl.id
            JOIN products p ON ibl.product_id = p.id
            WHERE ibl.product_id = ? AND pl.is_active = 1
            ORDER BY ibl.stock_quantity DESC
        ");
        $stmt->execute([$productId]);
        $locations = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($locations)) {
            // Fallback: show all pickup locations with total stock
            $fallbackStmt = $pdo->prepare("SELECT name, stock_quantity FROM products WHERE id = ?");
            $fallbackStmt->execute([$productId]);
            $product = $fallbackStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($product) {
                $allLocations = $pdo->query("SELECT id, name, address, city FROM pickup_locations WHERE is_active = 1")->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode([
                    'success' => true,
                    'data' => [
                        'product_id' => $productId,
                        'product_name' => $product['name'],
                        'total_stock' => (int)$product['stock_quantity'],
                        'is_location_specific' => false,
                        'locations' => array_map(function($loc) use ($product) {
                            return [
                                'location_id' => $loc['id'],
                                'location_name' => $loc['name'],
                                'location_address' => $loc['address'],
                                'city' => $loc['city'],
                                'stock_quantity' => (int)$product['stock_quantity'] // Same for all
                            ];
                        }, $allLocations)
                    ]
                ]);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Product not found']);
            }
        } else {
            echo json_encode([
                'success' => true,
                'data' => [
                    'product_id' => $productId,
                    'product_name' => $locations[0]['product_name'] ?? '',
                    'total_stock' => (int)$locations[0]['total_stock'],
                    'is_location_specific' => true,
                    'locations' => array_map(function($loc) {
                        return [
                            'location_id' => $loc['pickup_location_id'],
                            'location_name' => $loc['location_name'],
                            'location_address' => $loc['location_address'],
                            'city' => $loc['city'],
                            'stock_quantity' => (int)$loc['stock_quantity'],
                            'last_updated' => $loc['last_updated']
                        ];
                    }, $locations)
                ]
            ]);
        }
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Product ID required']);
    }
    exit;
}

// POST for admin updates to location inventory
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $userId = authenticate($pdo);
        $stmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user || !in_array($user['role'], ['super', 'store_manager'])) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: Only authorized staff can update inventory.']);
            exit;
        }
    } catch (Exception $e) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized: ' . $e->getMessage()]);
        exit;
    }
    
    $data = json_decode(file_get_contents('php://input'), true);
    $productId = (int)($data['product_id'] ?? 0);
    $locationId = (int)($data['location_id'] ?? 0);
    $quantity = (int)($data['quantity'] ?? 0);
    $action = $data['action'] ?? 'set'; // 'set' or 'adjust'
    
    if ($productId <= 0 || $locationId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Product ID and Location ID required']);
        exit;
    }
    
    try {
        $pdo->beginTransaction();
        
        if ($action === 'adjust') {
            // Adjust existing quantity
            $stmt = $pdo->prepare("
                INSERT INTO inventory_by_location (product_id, pickup_location_id, stock_quantity)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE stock_quantity = stock_quantity + ?
            ");
            $stmt->execute([$productId, $locationId, $quantity, $quantity]);
        } else {
            // Set absolute quantity
            $stmt = $pdo->prepare("
                INSERT INTO inventory_by_location (product_id, pickup_location_id, stock_quantity)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE stock_quantity = ?
            ");
            $stmt->execute([$productId, $locationId, $quantity, $quantity]);
        }
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Inventory updated successfully',
            'product_id' => $productId,
            'location_id' => $locationId,
            'new_quantity' => $quantity
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}
