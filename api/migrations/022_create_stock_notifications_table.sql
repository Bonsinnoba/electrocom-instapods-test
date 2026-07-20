-- Stock Notifications Table
-- Stores user requests to be notified when a product is back in stock

CREATE TABLE IF NOT EXISTS stock_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  notification_method ENUM('email', 'sms', 'both') DEFAULT 'both',
  status ENUM('pending', 'sent', 'cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP NULL,
  UNIQUE KEY unique_user_product (user_id, product_id, status),
  INDEX idx_product_status (product_id, status),
  INDEX idx_user_status (user_id, status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
