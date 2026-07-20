<?php
/**
 * api/inventory_utils.php
 * Logic for Dynamic Soft Reservations and Inventory Availability.
 * Refactored for Single Warehouse (Branching removed).
 */

/**
 * Calculates the 'Effective' available stock for a product.
 * Formula: Physical Stock - Active Pending Reservations.
 */
function getAvailableStock($productId, $pdo) {
    try {
        // 1. Get Physical Stock (Always from products table)
        $stmt = $pdo->prepare("SELECT stock_quantity FROM products WHERE id = ?");
        $stmt->execute([$productId]);
        $physicalStock = (int)$stmt->fetchColumn();

        // 2. Define Window based on stock levels
        $windowMinutes = ($physicalStock < 10) ? 5 : 20;

        // 3. Sum active reservations (Global)
        $sql = "
            SELECT SUM(oi.quantity) 
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_id = ? 
            AND o.status = 'pending'
            AND COALESCE(o.reserved_at, o.created_at) >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? MINUTE)
            AND (o.last_activity_at IS NULL OR o.last_activity_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 MINUTE))
        ";
        
        $params = [$productId, $windowMinutes];

        $resStmt = $pdo->prepare($sql);
        $resStmt->execute($params);
        $reservedStock = (int)$resStmt->fetchColumn();

        $available = $physicalStock - $reservedStock;
        return max(0, $available);
    } catch (Exception $e) {
        error_log("Inventory error: " . $e->getMessage());
        return 0;
    }
}

/**
 * Lazy Cancellation: Flips 'pending' orders to 'cancelled' if their reservation window has passed
 * OR if their heartbeat has gone silent.
 */
function lazyCancelOrders($pdo) {
    try {
        $selectSql = "
            SELECT id FROM orders o
            WHERE o.status = 'pending'
            AND (
                (o.last_activity_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 MINUTE))
                OR
                (
                    (EXISTS (
                        SELECT 1 FROM order_items oi 
                        JOIN products p ON oi.product_id = p.id 
                        WHERE oi.order_id = o.id AND p.stock_quantity >= 10
                    ) AND COALESCE(o.reserved_at, o.created_at) < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 20 MINUTE))
                    OR
                    (EXISTS (
                        SELECT 1 FROM order_items oi 
                        JOIN products p ON oi.product_id = p.id 
                        WHERE oi.order_id = o.id AND p.stock_quantity < 10
                    ) AND COALESCE(o.reserved_at, o.created_at) < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 MINUTE))
                )
            )
        ";
        $stmtSelect = $pdo->query($selectSql);
        $affectedIds = $stmtSelect->fetchAll(PDO::FETCH_COLUMN);

        if (!empty($affectedIds)) {
            $idsList = implode(',', array_map('intval', $affectedIds));
            $pdo->exec("UPDATE orders SET status = 'cancelled' WHERE id IN ($idsList)");

            // Batch insert order status logs to avoid N+1 query problem
            if (!empty($affectedIds)) {
                $values = [];
                $params = [];
                foreach ($affectedIds as $orderId) {
                    $values[] = '(?, ?, ?)';
                    $params[] = $orderId;
                    $params[] = 'cancelled';
                    $params[] = 'Reservation released automatically (Session inactive or timed out).';
                }
                $valuesStr = implode(',', $values);
                $pdo->prepare("INSERT INTO order_status_logs (order_id, status_key, message) VALUES $valuesStr")->execute($params);
            }

            if (function_exists('logger')) {
                logger('ok', 'INVENTORY', "Released " . count($affectedIds) . " abandoned reservations.");
            }
        }
        
        return count($affectedIds);
    } catch (Exception $e) {
        error_log("Lazy Cancellation error: " . $e->getMessage());
        return 0;
    }
}
