-- Migration: Create archive tables for data pruning
-- This creates separate archive tables to store old data before deletion

-- Archive table for orders
CREATE TABLE IF NOT EXISTS `orders_archive` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `original_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `status` varchar(50) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `archived_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `archive_data` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_original_id` (`original_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_archived_at` (`archived_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Archive table for system logs
CREATE TABLE IF NOT EXISTS `system_logs_archive` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `original_id` int(11) NOT NULL,
  `level` varchar(20) DEFAULT NULL,
  `source` varchar(50) DEFAULT NULL,
  `message` text,
  `created_at` datetime NOT NULL,
  `archived_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `archive_data` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_original_id` (`original_id`),
  KEY `idx_level` (`level`),
  KEY `idx_archived_at` (`archived_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Archive table for user activity
CREATE TABLE IF NOT EXISTS `user_activity_archive` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `original_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `activity_type` varchar(50) DEFAULT NULL,
  `description` text,
  `created_at` datetime NOT NULL,
  `archived_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `archive_data` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_original_id` (`original_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_activity_type` (`activity_type`),
  KEY `idx_archived_at` (`archived_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Archive table for product reviews
CREATE TABLE IF NOT EXISTS `product_reviews_archive` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `original_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `rating` int(11) DEFAULT NULL,
  `comment` text,
  `created_at` datetime NOT NULL,
  `archived_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `archive_data` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_original_id` (`original_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_archived_at` (`archived_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Archive metadata table
CREATE TABLE IF NOT EXISTS `archive_metadata` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `table_name` varchar(100) NOT NULL,
  `record_count` int(11) NOT NULL,
  `archived_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `archive_file` varchar(255) DEFAULT NULL,
  `compressed` tinyint(1) DEFAULT 0,
  `file_size` bigint(20) DEFAULT NULL,
  `pruned_by` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_table_name` (`table_name`),
  KEY `idx_archived_at` (`archived_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
