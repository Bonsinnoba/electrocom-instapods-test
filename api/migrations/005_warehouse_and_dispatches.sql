-- Migration: 005_warehouse_and_dispatches.sql
-- Description: Centralizes warehouse and dispatch schema previously handled in admin_locations.php

-- 1. Ensure store_branches exists with all required columns
CREATE TABLE IF NOT EXISTS store_branches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    branch_code VARCHAR(50) UNIQUE,
    address TEXT,
    city VARCHAR(100),
    region VARCHAR(100),
    status ENUM('Online', 'Standby', 'Offline') DEFAULT 'Online',
    load_level INT DEFAULT 50,
    type ENUM('headquarters', 'warehouse') DEFAULT 'warehouse',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add columns if they missed the initial table creation (Self-healing legacy)
-- Note: In a versioned migration, we usually assume the table is created correctly.
-- But to match existing logic, we ensure these exist.

-- 3. Seed initial Headquarters if empty
INSERT IGNORE INTO store_branches (name, branch_code, address, city, region, type) 
VALUES ('Accra (Headquarters)', 'ACC-HQ', 'Spintex Road, Accra', 'Accra', 'Greater Accra', 'headquarters');

-- 4. Create Warehouse Dispatches table
CREATE TABLE IF NOT EXISTS warehouse_dispatches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    warehouse_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    notes TEXT,
    status ENUM('pending', 'delivered', 'returned', 'undelivered') DEFAULT 'pending',
    dispatched_by INT NOT NULL,
    dispatched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (warehouse_id) REFERENCES store_branches(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
