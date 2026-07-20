-- Migration 013: Add delivery_method to orders
ALTER TABLE orders
ADD COLUMN delivery_method ENUM('pickup', 'door_to_door') DEFAULT 'pickup' AFTER status;
