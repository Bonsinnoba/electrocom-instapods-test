-- Migration: 029_add_products_version_column.sql
-- Description: Add version column to products table for optimistic locking to prevent race conditions

-- Add version column with default value 0
ALTER TABLE products ADD COLUMN version INT DEFAULT 0 AFTER bin;
