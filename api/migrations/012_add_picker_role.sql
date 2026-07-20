-- Migration 012: Ensure picker role exists in users.role enum
-- Adds picker (and preserves legacy branch_admin) for fulfillment workflow assignment.

ALTER TABLE users
MODIFY COLUMN role ENUM(
    'customer',
    'admin',
    'branch_admin',
    'marketing',
    'accountant',
    'store_manager',
    'pos_cashier',
    'picker',
    'super'
) DEFAULT 'customer';
