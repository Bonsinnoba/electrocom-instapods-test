-- Migration: 020_unify_branch_admin.sql
-- Description: Unifies the legacy 'branch_admin' role into 'store_manager' and refactors the role enum.

-- 1. Migrate any existing branch_admin users to store_manager
UPDATE users SET role = 'store_manager' WHERE role = 'branch_admin';

-- 2. Modify the role column in users table to drop 'branch_admin' and 'admin' from the ENUM definition
ALTER TABLE users MODIFY COLUMN role ENUM('customer', 'store_manager', 'marketing', 'accountant', 'pos_cashier', 'picker', 'super') DEFAULT 'customer';
