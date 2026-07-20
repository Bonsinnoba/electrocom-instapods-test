<?php
// backend/get_products.php
require_once 'db.php';
require_once 'inventory_utils.php';
require_once 'security.php';

// Lazy Cleanup: Clear expired reservations before listing products
lazyCancelOrders($pdo);

header('Content-Type: application/json');

try {
    $category = validateString($_GET['category'] ?? null);

    if ($category) {
        $stmt = $pdo->prepare("
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
            WHERE p.category = ? 
            AND p.status IN ('active', 'out_of_stock')
            ORDER BY p.created_at DESC
        ");
        $stmt->execute([$category]);
    } else {
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
    }

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

    // Decode JSON fields for frontend compatibility
    foreach ($products as &$product) {
        $product['colors'] = json_decode($product['colors'] ?? '[]', true);
        $product['specs'] = json_decode($product['specs'] ?? '{}', true);
        $product['included'] = json_decode($product['included'] ?? '[]', true);
        $product['gallery'] = json_decode($product['gallery'] ?? '[]', true);
        $product['price'] = (float)$product['price'];
        $product['rating'] = (float)($product['rating'] ?? 0);
        $product['variants'] = $variantsByProduct[$product['id']] ?? [];
    }

    sendResponse(true, 'Products fetched successfully', $products);
} catch (PDOException $e) {
    sendDatabaseError($e, 'Unable to fetch products.');
}
