-- PAN Demo Database Setup
-- Creates sample tables with data for testing the data-browser and API

-- Create database
CREATE DATABASE IF NOT EXISTS pan_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pan_demo;

-- Users table
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  userID INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  role ENUM('admin', 'user', 'guest') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Posts table
DROP TABLE IF EXISTS posts;
CREATE TABLE posts (
  postID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT,
  status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userID) REFERENCES users(userID) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Comments table
DROP TABLE IF EXISTS comments;
CREATE TABLE comments (
  commentID INT AUTO_INCREMENT PRIMARY KEY,
  postID INT NOT NULL,
  userID INT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (postID) REFERENCES posts(postID) ON DELETE CASCADE,
  FOREIGN KEY (userID) REFERENCES users(userID) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Products table
DROP TABLE IF EXISTS products;
CREATE TABLE products (
  productID INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  stock INT DEFAULT 0,
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Orders table
DROP TABLE IF EXISTS orders;
CREATE TABLE orders (
  orderID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userID) REFERENCES users(userID) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Insert sample users
INSERT INTO users (name, email, role) VALUES
('Alice Johnson', 'alice@example.com', 'admin'),
('Bob Smith', 'bob@example.com', 'user'),
('Carol White', 'carol@example.com', 'user'),
('David Brown', 'david@example.com', 'user'),
('Eve Davis', 'eve@example.com', 'guest'),
('Frank Miller', 'frank@example.com', 'user'),
('Grace Lee', 'grace@example.com', 'user'),
('Henry Wilson', 'henry@example.com', 'user');

-- Insert sample posts
INSERT INTO posts (userID, title, content, status) VALUES
(1, 'Getting Started with PAN', 'Page Area Network (PAN) is a lightweight messaging framework for building reactive web applications...', 'published'),
(1, 'Building Components', 'Learn how to create custom web components that communicate via the PAN bus...', 'published'),
(2, 'My First App', 'Today I built my first PAN application. It was surprisingly easy!', 'published'),
(2, 'Advanced Patterns', 'Exploring request/reply and retained messages in PAN...', 'draft'),
(3, 'Data Tables Tutorial', 'The pan-data-table component makes it easy to display and edit data...', 'published'),
(4, 'REST Connectors', 'How to connect your PAN app to REST APIs...', 'published'),
(4, 'Real-time Updates', 'Using Server-Sent Events with PAN for live data...', 'draft'),
(6, 'DevTools Extension', 'The PAN DevTools extension helps debug message flow...', 'published');

-- Insert sample comments
INSERT INTO comments (postID, userID, content) VALUES
(1, 2, 'Great introduction! This helped me understand PAN much better.'),
(1, 3, 'Can you add more examples?'),
(1, 1, 'Thanks! I will add more examples in the next post.'),
(2, 4, 'The component example was very clear. Thanks!'),
(3, 2, 'This is exactly what I was looking for!'),
(3, 5, 'How do I customize the table styles?'),
(5, 1, 'Excellent tutorial! Very comprehensive.'),
(6, 3, 'REST connectors are so useful. Thanks for the guide!'),
(8, 2, 'The DevTools extension is a game changer!');

-- Insert sample products
INSERT INTO products (name, description, price, stock, category) VALUES
('Wireless Mouse', 'Ergonomic wireless mouse with USB receiver', 29.99, 150, 'Electronics'),
('Mechanical Keyboard', 'RGB backlit mechanical keyboard with blue switches', 89.99, 75, 'Electronics'),
('USB-C Hub', '7-in-1 USB-C hub with HDMI, USB 3.0, SD card reader', 39.99, 200, 'Electronics'),
('Laptop Stand', 'Aluminum laptop stand with adjustable height', 49.99, 120, 'Accessories'),
('Webcam 1080p', 'Full HD webcam with built-in microphone', 69.99, 90, 'Electronics'),
('Desk Lamp', 'LED desk lamp with touch control and USB charging', 34.99, 180, 'Accessories'),
('Monitor Arm', 'Single monitor arm mount with cable management', 79.99, 60, 'Accessories'),
('Headphone Stand', 'Wooden headphone stand with cable organizer', 24.99, 220, 'Accessories'),
('Phone Holder', 'Adjustable phone holder for desk', 14.99, 300, 'Accessories'),
('Cable Organizer', 'Silicone cable management clips, pack of 10', 9.99, 500, 'Accessories');

-- Insert sample orders
INSERT INTO orders (userID, total, status) VALUES
(2, 119.98, 'delivered'),
(2, 49.99, 'delivered'),
(3, 89.99, 'shipped'),
(3, 174.97, 'processing'),
(4, 29.99, 'pending'),
(6, 139.98, 'delivered'),
(7, 69.99, 'shipped'),
(7, 44.98, 'processing'),
(8, 159.97, 'delivered');

-- Display summary
SELECT 'Database Setup Complete!' as status;
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as post_count FROM posts;
SELECT COUNT(*) as comment_count FROM comments;
SELECT COUNT(*) as product_count FROM products;
SELECT COUNT(*) as order_count FROM orders;
