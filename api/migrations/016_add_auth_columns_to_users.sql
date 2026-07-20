-- Migration 016: Add auth/security columns to users table
-- Ensures login.php required fields exist across older deployments.

SET @db_name = DATABASE();

SET @has_region = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'region'
);
SET @has_status = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'status'
);
SET @has_is_verified = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_verified'
);
SET @has_verification_method = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'verification_method'
);
SET @has_verification_code = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'verification_code'
);
SET @has_login_attempts = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'login_attempts'
);
SET @has_lockout_until = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'lockout_until'
);

SET @sql = IF(@has_region = 0, 'ALTER TABLE users ADD COLUMN region VARCHAR(100) DEFAULT NULL AFTER address', 'DO 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(@has_status = 0, "ALTER TABLE users ADD COLUMN status ENUM('Active', 'Suspended') DEFAULT 'Active' AFTER role", 'DO 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(@has_is_verified = 0, 'ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE AFTER status', 'DO 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(@has_verification_method = 0, "ALTER TABLE users ADD COLUMN verification_method ENUM('email', 'sms') DEFAULT 'email' AFTER is_verified", 'DO 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(@has_verification_code = 0, 'ALTER TABLE users ADD COLUMN verification_code VARCHAR(10) DEFAULT NULL AFTER verification_method', 'DO 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(@has_login_attempts = 0, 'ALTER TABLE users ADD COLUMN login_attempts INT DEFAULT 0 AFTER verification_code', 'DO 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(@has_lockout_until = 0, 'ALTER TABLE users ADD COLUMN lockout_until DATETIME DEFAULT NULL AFTER login_attempts', 'DO 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
