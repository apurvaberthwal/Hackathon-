-- Run this in your MySQL client
USE hackathon;

-- Users table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  google_id VARCHAR(255) UNIQUE,
  email VARCHAR(255) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  preferences JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  task_type ENUM('work', 'personal', 'health') DEFAULT 'work',
  priority TINYINT DEFAULT 3,
  duration INT DEFAULT 30,
  scheduled_time DATETIME,
  status ENUM('pending', 'completed', 'postponed') DEFAULT 'pending',
  ai_metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Roadmaps table
CREATE TABLE roadmaps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  roadmap JSON NOT NULL,
  version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);