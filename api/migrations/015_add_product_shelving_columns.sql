-- Migration 015: Add product shelving columns
-- Adds legacy location plus structured shelving fields used by Product Manager.

SET @db_name = DATABASE();

SET @has_location = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'products' AND COLUMN_NAME = 'location'
);
SET @has_aisle = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'products' AND COLUMN_NAME = 'aisle'
);
SET @has_rack = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'products' AND COLUMN_NAME = 'rack'
);
SET @has_bin = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'products' AND COLUMN_NAME = 'bin'
);

SET @sql = IF(@has_location = 0, 'ALTER TABLE products ADD COLUMN location VARCHAR(255) AFTER product_code', 'DO 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(@has_aisle = 0, 'ALTER TABLE products ADD COLUMN aisle VARCHAR(50) AFTER location', 'DO 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(@has_rack = 0, 'ALTER TABLE products ADD COLUMN rack VARCHAR(50) AFTER aisle', 'DO 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(@has_bin = 0, 'ALTER TABLE products ADD COLUMN bin VARCHAR(50) AFTER rack', 'DO 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
