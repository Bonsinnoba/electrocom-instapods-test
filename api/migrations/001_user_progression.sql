-- Migration: 001_user_progression.sql 
-- Description: Adds level and level_name to users table if they don't exist.

DROP PROCEDURE IF EXISTS ehub_add_user_progression;
DELIMITER //
CREATE PROCEDURE ehub_add_user_progression()
BEGIN
    IF NOT EXISTS (SELECT * FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'level') THEN
        ALTER TABLE users ADD COLUMN level INT DEFAULT 1 AFTER role;
    END IF;

    IF NOT EXISTS (SELECT * FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'level_name') THEN
        ALTER TABLE users ADD COLUMN level_name VARCHAR(50) DEFAULT 'Starter' AFTER level;
    END IF;
END //
DELIMITER ;

CALL ehub_add_user_progression();
DROP PROCEDURE IF EXISTS ehub_add_user_progression;
