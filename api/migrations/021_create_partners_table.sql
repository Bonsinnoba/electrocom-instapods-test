-- Migration: Create Partners Table and Populate Default Seed Data
CREATE TABLE IF NOT EXISTS partners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    logo_url LONGTEXT NOT NULL,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO partners (name, logo_url, display_order, is_active) VALUES
('SecurePay Africa', 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?w=200&h=80&fit=crop&q=80&auto=format', 1, 1),
('Vanguard Systems', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=200&h=80&fit=crop&q=80&auto=format', 2, 1),
('CloudScale Hosting', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&h=80&fit=crop&q=80&auto=format', 3, 1),
('Aero Logistics', 'https://images.unsplash.com/photo-1508873535684-277a3cbcc4e8?w=200&h=80&fit=crop&q=80&auto=format', 4, 1),
('Apex Tech', 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=200&h=80&fit=crop&q=80&auto=format', 5, 1);
