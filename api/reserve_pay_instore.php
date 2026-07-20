<?php
require_once 'db.php';
require_once 'security.php';
require_once 'inventory_utils.php';

header('Content-Type: application/json');

/**
 * Reserve Online, Pay In-Store
 * Allows customers to reserve items online and pay when picking up at store
 * Reduces friction for customers who prefer cash or want to see items before paying
 */

// Self-heal schema for reservations
$pdo->exec("CREATE TABLE IF NOT EXISTS reservations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    order_id INT DEFAULT NULL,
    pickup_location_id INT NOT NULL,
    reservation_code VARCHAR(20) UNIQUE NOT NULL,
    status ENUM('pending', 'confirmed', 'picked_up', 'cancelled', 'expired') DEFAULT 'pending',
    total_amount DECIMAL(10,2) NOT NULL,
    expires_at DATETIME NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (pickup_location_id) REFERENCES pickup_locations(id) ON DELETE CASCADE,
    INDEX idx_reservation_code (reservation_code),
    INDEX idx_user_status (user_id, status),
    INDEX idx_expires_at (expires_at, status)
)");

$pdo->exec("CREATE TABLE IF NOT EXISTS reservation_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price_at_reserve DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_reservation_id (reservation_id)
)");

try {
    $userId = authenticate($pdo);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = $_GET['action'] ?? '';
    
    if ($action === 'my_reservations') {
        // Get user's active reservations
        $stmt = $pdo->prepare("
            SELECT r.*, pl.name as pickup_location_name, pl.address as pickup_address,
                   GROUP_CONCAT(p.name SEPARATOR ', ') as items
            FROM reservations r
            JOIN pickup_locations pl ON r.pickup_location_id = pl.id
            LEFT JOIN reservation_items ri ON r.id = ri.reservation_id
            LEFT JOIN products p ON ri.product_id = p.id
            WHERE r.user_id = ? AND r.status IN ('pending', 'confirmed')
            GROUP BY r.id
            ORDER BY r.created_at DESC
        ");
        $stmt->execute([$userId]);
        $reservations = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'data' => $reservations]);
    } elseif ($action === 'lookup') {
        // Staff lookup by reservation code
        $code = sanitizeInput($_GET['code'] ?? '');
        if (empty($code)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Reservation code required']);
            exit;
        }
        
        $stmt = $pdo->prepare("
            SELECT r.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
                   pl.name as pickup_location_name, pl.address as pickup_address,
                   GROUP_CONCAT(CONCAT(p.name, ' (', ri.quantity, ')') SEPARATOR ', ') as items
            FROM reservations r
            JOIN users u ON r.user_id = u.id
            JOIN pickup_locations pl ON r.pickup_location_id = pl.id
            LEFT JOIN reservation_items ri ON r.id = ri.reservation_id
            LEFT JOIN products p ON ri.product_id = p.id
            WHERE r.reservation_code = ?
            GROUP BY r.id
        ");
        $stmt->execute([$code]);
        $reservation = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$reservation) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Reservation not found']);
            exit;
        }
        
        echo json_encode(['success' => true, 'data' => $reservation]);
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? '';

if ($action === 'create') {
    // Create a new reservation
    $items = $data['items'] ?? [];
    $pickupLocationId = (int)($data['pickup_location_id'] ?? 0);
    $customerName = sanitizeInput($data['customer_name'] ?? '');
    $customerPhone = sanitizeInput($data['customer_phone'] ?? '');
    $notes = sanitizeInput($data['notes'] ?? '');
    
    if (empty($items) || $pickupLocationId <= 0 || empty($customerName)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Items, pickup location, and customer name are required']);
        exit;
    }
    
    // Verify pickup location exists
    $locStmt = $pdo->prepare("SELECT id, name FROM pickup_locations WHERE id = ? AND is_active = 1");
    $locStmt->execute([$pickupLocationId]);
    $location = $locStmt->fetch(PDO::FETCH_ASSOC);
    if (!$location) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid pickup location']);
        exit;
    }
    
    try {
        $pdo->beginTransaction();
        
        // Calculate total and check stock
        $totalAmount = 0;
        usort($items, function($a, $b) {
            return (int)($a['product_id'] ?? 0) <=> (int)($b['product_id'] ?? 0);
        });
        
        foreach ($items as $item) {
            $productId = (int)$item['product_id'];
            $quantity = (int)$item['quantity'];
            
            $prodStmt = $pdo->prepare("SELECT name, price FROM products WHERE id = ? FOR UPDATE");
            $prodStmt->execute([$productId]);
            $product = $prodStmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$product) {
                throw new Exception("Product ID {$productId} not found");
            }
            
            $available = getAvailableStock($productId, $pdo);
            if ($available < $quantity) {
                throw new Exception("Insufficient stock for '{$product['name']}'. Available: {$available}, Requested: {$quantity}");
            }
            
            $totalAmount += $product['price'] * $quantity;
        }
        
        // Generate unique reservation code
        do {
            $reservationCode = 'RES-' . strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 8));
            $checkStmt = $pdo->prepare("SELECT id FROM reservations WHERE reservation_code = ?");
            $checkStmt->execute([$reservationCode]);
        } while ($checkStmt->fetchColumn());
        
        // Set expiration (24 hours from now)
        $expiresAt = date('Y-m-d H:i:s', time() + 86400);
        
        // Create reservation
        $stmt = $pdo->prepare("
            INSERT INTO reservations (user_id, pickup_location_id, reservation_code, status, total_amount, expires_at, customer_name, customer_phone, notes)
            VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$userId, $pickupLocationId, $reservationCode, $totalAmount, $expiresAt, $customerName, $customerPhone, $notes]);
        $reservationId = $pdo->lastInsertId();
        
        // Add items to reservation
        $itemStmt = $pdo->prepare("INSERT INTO reservation_items (reservation_id, product_id, quantity, price_at_reserve) VALUES (?, ?, ?, ?)");
        foreach ($items as $item) {
            $productId = (int)$item['product_id'];
            $quantity = (int)$item['quantity'];
            
            $priceStmt = $pdo->prepare("SELECT price FROM products WHERE id = ?");
            $priceStmt->execute([$productId]);
            $price = $priceStmt->fetchColumn();
            
            $itemStmt->execute([$reservationId, $productId, $quantity, $price]);
        }
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Reservation created successfully',
            'data' => [
                'reservation_id' => $reservationId,
                'reservation_code' => $reservationCode,
                'total_amount' => $totalAmount,
                'expires_at' => $expiresAt,
                'pickup_location' => $location['name']
            ]
        ]);
        
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    
} elseif ($action === 'confirm') {
    // Staff confirms reservation and converts to order
    $reservationCode = sanitizeInput($data['reservation_code'] ?? '');
    $paymentMethod = sanitizeInput($data['payment_method'] ?? 'cash');
    
    if (empty($reservationCode)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Reservation code required']);
        exit;
    }
    
    try {
        $pdo->beginTransaction();
        
        // Get reservation
        $stmt = $pdo->prepare("
            SELECT r.*, u.id as user_id
            FROM reservations r
            JOIN users u ON r.user_id = u.id
            WHERE r.reservation_code = ? AND r.status = 'pending'
            FOR UPDATE
        ");
        $stmt->execute([$reservationCode]);
        $reservation = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$reservation) {
            throw new Exception('Reservation not found or already processed');
        }
        
        if (strtotime($reservation['expires_at']) < time()) {
            $pdo->prepare("UPDATE reservations SET status = 'expired' WHERE id = ?")->execute([$reservation['id']]);
            throw new Exception('Reservation has expired');
        }
        
        // Get reservation items
        $itemsStmt = $pdo->prepare("SELECT product_id, quantity, price_at_reserve FROM reservation_items WHERE reservation_id = ?");
        $itemsStmt->execute([$reservation['id']]);
        $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Create order
        $orderStmt = $pdo->prepare("
            INSERT INTO orders (user_id, total_amount, status, payment_method, delivery_method, pickup_location_id, customer_email, order_type)
            VALUES (?, ?, 'processing', ?, 'pickup', ?, ?, 'reservation')
        ");
        $userEmailStmt = $pdo->prepare("SELECT email FROM users WHERE id = ?");
        $userEmailStmt->execute([$reservation['user_id']]);
        $userEmail = $userEmailStmt->fetchColumn();
        
        $orderStmt->execute([
            $reservation['user_id'],
            $reservation['total_amount'],
            $paymentMethod,
            $reservation['pickup_location_id'],
            $userEmail
        ]);
        $orderId = $pdo->lastInsertId();
        
        // Add order items
        $orderItemStmt = $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)");
        foreach ($items as $item) {
            $orderItemStmt->execute([$orderId, $item['product_id'], $item['quantity'], $item['price_at_reserve']]);
            
            // Deduct stock
            $pdo->prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?")->execute([$item['quantity'], $item['product_id']]);
        }
        
        // Update reservation status
        $pdo->prepare("UPDATE reservations SET status = 'confirmed', order_id = ? WHERE id = ?")->execute([$orderId, $reservation['id']]);
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Reservation confirmed and order created',
            'order_id' => $orderId
        ]);
        
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    
} elseif ($action === 'cancel') {
    // User cancels their reservation
    $reservationId = (int)($data['reservation_id'] ?? 0);
    
    if ($reservationId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Reservation ID required']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("
            UPDATE reservations 
            SET status = 'cancelled' 
            WHERE id = ? AND user_id = ? AND status IN ('pending', 'confirmed')
        ");
        $stmt->execute([$reservationId, $userId]);
        
        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'message' => 'Reservation cancelled']);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Reservation not found or cannot be cancelled']);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    
} else {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid action']);
}
