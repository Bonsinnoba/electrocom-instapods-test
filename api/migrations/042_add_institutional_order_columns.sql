-- Migration 042: Link orders to institutions/quotes and allow invoice payment
-- Description: payment_method is already VARCHAR(50), so 'invoice' requires
-- no enum change there - only application-layer handling. This migration
-- just adds the linkage columns needed for a quote-to-order conversion.

ALTER TABLE orders
ADD COLUMN institution_id INT DEFAULT NULL AFTER user_id,
ADD COLUMN quote_id INT DEFAULT NULL AFTER institution_id,
ADD CONSTRAINT fk_orders_institution FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_orders_quote FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL,
ADD INDEX idx_orders_institution (institution_id);
