-- Elegant Moments — MySQL schema (MySQL 5.7+ / 8.x / MariaDB 10.3+)
-- Run with:  mysql -u root -p < database/schema.sql
-- or simply: npm run db:setup   (creates DB, tables and the admin user)

CREATE DATABASE IF NOT EXISTS elegant_moments
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE elegant_moments;

CREATE TABLE IF NOT EXISTS admins (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  last_login_at DATETIME NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bookings (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference   VARCHAR(20)  NOT NULL,
  brand       ENUM('weddings','photography') NOT NULL,
  service     VARCHAR(60)  NOT NULL,
  name        VARCHAR(100) NOT NULL,
  phone       VARCHAR(30)  NOT NULL,
  email       VARCHAR(190) NULL,
  event_date  DATE         NOT NULL,
  location    VARCHAR(150) NULL,
  shoot_type  ENUM('studio','outdoor','both') NULL,
  note        TEXT NULL,
  status      ENUM('pending','confirmed','completed','cancelled') NOT NULL DEFAULT 'pending',
  admin_notes TEXT NULL,
  ip_address  VARCHAR(45)  NULL,
  user_agent  VARCHAR(255) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bookings_reference (reference),
  KEY idx_bookings_date (event_date),
  KEY idx_bookings_status (status),
  KEY idx_bookings_brand_date (brand, event_date),
  KEY idx_bookings_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contact_messages (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  phone      VARCHAR(30)  NOT NULL,
  email      VARCHAR(190) NULL,
  topic      VARCHAR(80)  NOT NULL,
  message    TEXT NOT NULL,
  status     ENUM('new','read','replied','archived') NOT NULL DEFAULT 'new',
  ip_address VARCHAR(45)  NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_messages_status (status),
  KEY idx_messages_created (created_at)
) ENGINE=InnoDB;

-- Dates the studio is unavailable (holidays, other commitments).
-- brand = 'all' blocks both Weddings and Photography.
CREATE TABLE IF NOT EXISTS blocked_dates (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  blocked_date DATE NOT NULL,
  brand        ENUM('all','weddings','photography') NOT NULL DEFAULT 'all',
  reason       VARCHAR(150) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_blocked (blocked_date, brand)
) ENGINE=InnoDB;
