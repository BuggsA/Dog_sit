-- Purfect Pet database (Cloudflare D1 / SQLite)
-- Apply with:  npx wrangler d1 execute purfect-pet --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  status      TEXT    NOT NULL DEFAULT 'pending',   -- pending | approved | declined | done
  name        TEXT    NOT NULL,
  phone       TEXT    NOT NULL,
  email       TEXT    NOT NULL,
  zip         TEXT    NOT NULL,
  town        TEXT,
  county      TEXT,
  pet_types   TEXT,        -- comma separated: dog,cat
  pets        TEXT,        -- free text names/breeds/ages
  age_flag    INTEGER NOT NULL DEFAULT 0,
  service     TEXT    NOT NULL,   -- visit | overnight | meet
  start_date  TEXT    NOT NULL,   -- YYYY-MM-DD
  end_date    TEXT    NOT NULL,
  minutes     INTEGER,
  per_day     INTEGER,
  hours       INTEGER,
  notes       TEXT,
  new_client  INTEGER NOT NULL DEFAULT 1,
  estimate    REAL,               -- website estimate at time of request (null = custom quote)
  admin_notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status, start_date);

-- Days Anissa is unavailable (vacation, fully booked, etc.)
CREATE TABLE IF NOT EXISTS blocked_dates (
  date TEXT PRIMARY KEY,   -- YYYY-MM-DD
  note TEXT
);
