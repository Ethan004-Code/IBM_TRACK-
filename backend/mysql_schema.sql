CREATE DATABASE IF NOT EXISTS echopantry
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE echopantry;

CREATE TABLE IF NOT EXISTS user_profiles (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(60) NOT NULL,
  created_at DATETIME NOT NULL,
  last_login_at DATETIME NULL,
  deleted_at DATETIME NULL,
  average_rating DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  completed_trades INT NOT NULL DEFAULT 0,
  total_items_saved INT NOT NULL DEFAULT 0,
  INDEX idx_profiles_deleted_at (deleted_at)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  INDEX idx_sessions_user_id (user_id),
  INDEX idx_sessions_expires_at (expires_at),
  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id)
    REFERENCES user_profiles(id)
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_records (
  record_type VARCHAR(40) NOT NULL,
  id VARCHAR(80) NOT NULL,
  row_data JSON NOT NULL,
  PRIMARY KEY (record_type, id),
  INDEX idx_records_type (record_type)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;