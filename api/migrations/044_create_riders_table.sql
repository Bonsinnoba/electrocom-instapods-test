-- Migration 044: Riders (self-owned delivery fleet)

CREATE TABLE IF NOT EXISTS riders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL COMMENT 'Optional link if the rider also has a login',
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    vehicle_type ENUM('bike', 'motorcycle', 'car', 'van') DEFAULT 'motorcycle',
    status ENUM('available', 'on_delivery', 'offline') DEFAULT 'offline',
    default_zone_id INT DEFAULT NULL,
    current_lat DECIMAL(10, 7) DEFAULT NULL,
    current_lng DECIMAL(10, 7) DEFAULT NULL,
    last_location_update DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (default_zone_id) REFERENCES shipping_zones(id) ON DELETE SET NULL,
    INDEX idx_riders_status (status)
);
