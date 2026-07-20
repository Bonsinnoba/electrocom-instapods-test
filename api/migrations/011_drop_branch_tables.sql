-- Migration: 011_drop_branch_tables.sql
-- Description: Clears up all legacy branch, picking, and location tables/columns from the multi-branch architecture.

-- 1. Drop picking tasks
DROP TABLE IF EXISTS picking_tasks;

-- 2. Drop warehouse dispatches (it depends on store_branches and products)
DROP TABLE IF EXISTS warehouse_dispatches;

-- 3. Drop product locations (it depends on store_branches)
DROP TABLE IF EXISTS product_locations;

-- 4. Drop store branches
DROP TABLE IF EXISTS store_branches;

-- 5. Remove source_branch_id from orders table if it exists
-- We wrap this in a dynamic procedure so it doesn't fail if the column was already removed manually
DELIMITER //
CREATE PROCEDURE DropSourceBranchIdFromOrders()
BEGIN
    DECLARE col_exists INT;
    SELECT COUNT(*) INTO col_exists 
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'orders' 
      AND COLUMN_NAME = 'source_branch_id';
      
    IF col_exists > 0 THEN
        ALTER TABLE orders DROP COLUMN source_branch_id;
    END IF;
END //
DELIMITER ;

CALL DropSourceBranchIdFromOrders();
DROP PROCEDURE DropSourceBranchIdFromOrders;
