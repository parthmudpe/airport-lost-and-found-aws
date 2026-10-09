-- ============================================================
-- Airport Lost & Found Management System - Schema
-- Local implementation: SQLite (stands in for Amazon DynamoDB)
-- See docs/database.md for the DynamoDB single-table access-pattern
-- mapping that this schema mirrors conceptually.
-- ============================================================

CREATE TABLE IF NOT EXISTS airports (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,           -- e.g. JFK
  name TEXT NOT NULL,
  city TEXT,
  country TEXT,
  terminals TEXT,                      -- JSON array of terminal names
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('PASSENGER','STAFF','ADMIN')),
  airport_id TEXT,                     -- for STAFF: assigned airport
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (airport_id) REFERENCES airports(id)
);

CREATE TABLE IF NOT EXISTS lost_items (
  id TEXT PRIMARY KEY,
  report_number TEXT UNIQUE NOT NULL,  -- human friendly e.g. LF-2026-00001
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  model TEXT,
  color TEXT,
  serial_number TEXT,
  unique_features TEXT,
  date_lost TEXT NOT NULL,
  time_lost TEXT,
  airport_id TEXT NOT NULL,
  terminal TEXT,
  location_area TEXT,
  flight_number TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  images TEXT,                          -- JSON array of storage keys
  additional_notes TEXT,
  status TEXT NOT NULL DEFAULT 'REPORTED' CHECK (status IN
    ('REPORTED','SEARCHING','POSSIBLE_MATCH','MATCH_CONFIRMED',
     'OWNERSHIP_VERIFICATION','RETURNED','CLOSED','REJECTED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (airport_id) REFERENCES airports(id)
);
CREATE INDEX IF NOT EXISTS idx_lost_items_user ON lost_items(user_id);
CREATE INDEX IF NOT EXISTS idx_lost_items_status ON lost_items(status);
CREATE INDEX IF NOT EXISTS idx_lost_items_airport ON lost_items(airport_id);
CREATE INDEX IF NOT EXISTS idx_lost_items_category ON lost_items(category);

CREATE TABLE IF NOT EXISTS found_items (
  id TEXT PRIMARY KEY,
  found_number TEXT UNIQUE NOT NULL,    -- e.g. FD-2026-00001
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  model TEXT,
  color TEXT,
  serial_number TEXT,
  unique_features TEXT,
  date_found TEXT NOT NULL,
  time_found TEXT,
  airport_id TEXT NOT NULL,
  terminal TEXT,
  location_area TEXT,
  found_by_staff_id TEXT NOT NULL,
  storage_location TEXT,
  images TEXT,                          -- JSON array of storage keys
  status TEXT NOT NULL DEFAULT 'FOUND' CHECK (status IN
    ('FOUND','IN_STORAGE','POSSIBLE_MATCH','CLAIM_PENDING',
     'OWNERSHIP_VERIFICATION','RETURNED','UNCLAIMED','CLOSED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (found_by_staff_id) REFERENCES users(id),
  FOREIGN KEY (airport_id) REFERENCES airports(id)
);
CREATE INDEX IF NOT EXISTS idx_found_items_status ON found_items(status);
CREATE INDEX IF NOT EXISTS idx_found_items_airport ON found_items(airport_id);
CREATE INDEX IF NOT EXISTS idx_found_items_category ON found_items(category);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  lost_item_id TEXT NOT NULL,
  found_item_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('HIGH','MEDIUM','LOW')),
  reasons TEXT,                         -- JSON array of matching reasons
  differences TEXT,                     -- JSON array of differing fields
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN
    ('PENDING_REVIEW','STAFF_CONFIRMED','STAFF_REJECTED','OWNERSHIP_PENDING',
     'OWNERSHIP_VERIFIED','OWNERSHIP_REJECTED','COMPLETED')),
  reviewed_by_staff_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (lost_item_id) REFERENCES lost_items(id),
  FOREIGN KEY (found_item_id) REFERENCES found_items(id),
  FOREIGN KEY (reviewed_by_staff_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_matches_lost ON matches(lost_item_id);
CREATE INDEX IF NOT EXISTS idx_matches_found ON matches(found_item_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);

CREATE TABLE IF NOT EXISTS ownership_verifications (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  lost_item_id TEXT NOT NULL,
  passenger_id TEXT NOT NULL,
  proof_text TEXT,                      -- description known only to owner, purchase details, etc.
  proof_documents TEXT,                 -- JSON array of storage keys (private)
  verification_method TEXT,             -- SERIAL_NUMBER | IMEI | UNIQUE_FEATURE | PURCHASE_DETAILS | DOCUMENT | STAFF_QUESTION
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN
    ('REQUESTED','SUBMITTED','STAFF_APPROVED','STAFF_REJECTED')),
  reviewed_by_staff_id TEXT,
  staff_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (match_id) REFERENCES matches(id),
  FOREIGN KEY (lost_item_id) REFERENCES lost_items(id),
  FOREIGN KEY (passenger_id) REFERENCES users(id),
  FOREIGN KEY (reviewed_by_staff_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_ownership_match ON ownership_verifications(match_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,                   -- e.g. POSSIBLE_MATCH_FOUND, OWNERSHIP_VERIFIED, ITEM_RETURNED
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_entity_type TEXT,             -- LOST_ITEM | FOUND_ITEM | MATCH | OWNERSHIP_VERIFICATION
  related_entity_id TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  channel TEXT NOT NULL DEFAULT 'INAPP',-- INAPP | EMAIL | SMS
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata TEXT,                        -- JSON blob
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
