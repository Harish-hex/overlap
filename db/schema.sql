CREATE DATABASE IF NOT EXISTS overlap CHARACTER SET utf8mb4;
USE overlap;

CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(16) NOT NULL UNIQUE,
  title VARCHAR(120) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  day_start TIME NOT NULL,
  day_end TIME NOT NULL,
  slot_minutes SMALLINT NOT NULL,
  meeting_length SMALLINT NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  admin_token CHAR(32) NOT NULL,
  final_slot INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  name VARCHAR(60) NOT NULL,
  edit_token CHAR(32) NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS availability (
  participant_id INT NOT NULL,
  slot_index INT NOT NULL,
  PRIMARY KEY (participant_id, slot_index),
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);
