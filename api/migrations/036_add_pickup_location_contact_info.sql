-- Migration 036: Add contact information and pickup instructions to pickup_locations table

ALTER TABLE pickup_locations
ADD COLUMN contact_person VARCHAR(150) DEFAULT NULL AFTER longitude,
ADD COLUMN contact_phone VARCHAR(20) DEFAULT NULL AFTER contact_person,
ADD COLUMN pickup_instructions TEXT DEFAULT NULL AFTER contact_phone,
ADD COLUMN what_to_bring TEXT DEFAULT NULL AFTER pickup_instructions,
ADD COLUMN id_requirements TEXT DEFAULT NULL AFTER what_to_bring;
