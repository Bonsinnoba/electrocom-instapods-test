-- Migration 038: Add 'sales' role to users.role enum
-- Description: Introduces a dedicated staff role for managing institutional
-- quote requests (see 039-041). 'super' already bypasses all requireRole()
-- checks, so super admins retain full access without being listed explicitly.

ALTER TABLE users
MODIFY COLUMN role ENUM(
    'customer',
    'store_manager',
    'marketing',
    'accountant',
    'pos_cashier',
    'picker',
    'sales',
    'super'
) DEFAULT 'customer';
