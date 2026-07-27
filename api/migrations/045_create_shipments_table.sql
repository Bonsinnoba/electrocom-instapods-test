-- Migration 045: Shipments
-- Description: One row per order's fulfillment leg, regardless of whether
-- it's carried by the self-owned fleet or an external carrier. Status
-- changes are written to order_status_logs (existing timeline table) so
-- the order-tracking UI needs no changes to display shipment events.

CREATE TABLE IF NOT EXISTS shipments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    provider_type ENUM('self_fleet', 'carrier') NOT NULL DEFAULT 'self_fleet',
    zone_id INT DEFAULT NULL COMMENT 'Set when provider_type = self_fleet',
    rider_id INT DEFAULT NULL COMMENT 'Set when provider_type = self_fleet',
    carrier_name VARCHAR(100) DEFAULT NULL COMMENT 'Set when provider_type = carrier, e.g. fedex, dhl',
    tracking_number VARCHAR(150) DEFAULT NULL,
    status ENUM('pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'cancelled') DEFAULT 'pending',
    cost DECIMAL(10, 2) DEFAULT 0.00,
    origin_address TEXT,
    destination_address TEXT,
    estimated_delivery DATETIME DEFAULT NULL,
    delivered_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (zone_id) REFERENCES shipping_zones(id) ON DELETE SET NULL,
    FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE SET NULL,
    INDEX idx_shipments_order (order_id),
    INDEX idx_shipments_status (status),
    INDEX idx_shipments_rider (rider_id)
);
