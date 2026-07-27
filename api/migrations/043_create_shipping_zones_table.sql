-- Migration 043: Shipping zones for self-fleet delivery
-- Description: Replaces the hardcoded region logic in
-- calculateRegionalShipping() (security.php) with DB-driven zones.
-- That function remains as a fallback when no zone matches (see 047).

CREATE TABLE IF NOT EXISTS shipping_zones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    region VARCHAR(100) DEFAULT NULL,
    -- Simple radius model to start; center_lat/lng + radius_km covers most
    -- self-fleet coverage areas without needing full polygon support yet.
    center_lat DECIMAL(10, 7) DEFAULT NULL,
    center_lng DECIMAL(10, 7) DEFAULT NULL,
    radius_km DECIMAL(6, 2) DEFAULT NULL,
    base_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    per_km_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_shipping_zones_active (is_active)
);
