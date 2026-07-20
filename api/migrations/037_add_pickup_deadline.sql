-- Migration 037: Add pickup deadline days to pickup_locations table

ALTER TABLE pickup_locations
ADD COLUMN pickup_deadline_days INT DEFAULT 7 AFTER id_requirements;
