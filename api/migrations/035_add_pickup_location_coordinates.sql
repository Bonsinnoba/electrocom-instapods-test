-- Migration 035: Add latitude and longitude columns to pickup_locations table

ALTER TABLE pickup_locations
ADD COLUMN latitude DECIMAL(10, 8) DEFAULT NULL AFTER city,
ADD COLUMN longitude DECIMAL(11, 8) DEFAULT NULL AFTER latitude;

-- Update existing pickup locations with approximate coordinates
-- Accra area (Madina): ~5.6833° N, -0.1667° W
UPDATE pickup_locations 
SET latitude = 5.6833, longitude = -0.1667 
WHERE city LIKE '%Accra%' OR address LIKE '%Accra%';

-- Wa area: ~10.0623° N, -2.5086° W  
UPDATE pickup_locations 
SET latitude = 10.0623, longitude = -2.5086 
WHERE city LIKE '%Wa%' OR address LIKE '%Wa%';
