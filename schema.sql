-- Walks for Lucy database (Cloudflare D1 / SQLite)
-- Apply with:  npx wrangler d1 execute walks-for-lucy --remote --file=schema.sql

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

-- ───────── Client accounts (clients log in at /account with an emailed code) ─────────
-- Booking requests are linked to a client by email address.
CREATE TABLE IF NOT EXISTS clients (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT    NOT NULL UNIQUE,   -- lowercase, the address they log in with
  name            TEXT,
  phone           TEXT,
  address         TEXT,
  zip             TEXT,
  emergency_name  TEXT,
  emergency_phone TEXT,
  vet_name        TEXT,
  vet_phone       TEXT,
  home_notes      TEXT,   -- keys / lockbox, alarm, parking, Wi-Fi, house rules
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  type        TEXT    NOT NULL,   -- dog | cat | bird | guineapig | turtle | other
  breed       TEXT,
  age         TEXT,
  feeding     TEXT,   -- what, how much, when
  medications TEXT,
  behavior    TEXT,   -- good with dogs/kids? leash manners, fears, hiding spots
  notes       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pets_client ON pets(client_id);

-- ───────── Visit reports: Anissa's notes & photos after each visit ─────────
CREATE TABLE IF NOT EXISTS visit_reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT    NOT NULL,   -- the client's email (lowercase); this is who can see it
  request_id  INTEGER,            -- the booking it belongs to, if any
  visit_date  TEXT    NOT NULL,   -- YYYY-MM-DD
  visit_time  TEXT,               -- e.g. "8:15 AM"
  done        TEXT,               -- comma separated checklist: walk,fed,water,…
  notes       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reports_email ON visit_reports(email, visit_date);

CREATE TABLE IF NOT EXISTS report_photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id   INTEGER NOT NULL REFERENCES visit_reports(id) ON DELETE CASCADE,
  r2_key      TEXT    NOT NULL,   -- file in the walks-for-lucy-photos bucket
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_photos_report ON report_photos(report_id);

-- ───────── Messages between Anissa and each client (one thread per client email) ─────────
CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT    NOT NULL,   -- the client's thread (lowercase)
  sender      TEXT    NOT NULL,   -- client | anissa
  body        TEXT    NOT NULL,
  read_at     TEXT,               -- when the other person opened it
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_email ON messages(email, id);

-- ───────── Bills (clients pay Anissa directly; she marks them paid) ─────────
CREATE TABLE IF NOT EXISTS bills (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT    NOT NULL,   -- the client (lowercase)
  request_id  INTEGER,            -- the booking it's for, if any
  lines       TEXT    NOT NULL,   -- JSON: [{"label": "...", "amount": 17}]
  total       REAL    NOT NULL,
  note        TEXT,
  due_date    TEXT,               -- YYYY-MM-DD
  status      TEXT    NOT NULL DEFAULT 'unpaid',   -- unpaid | paid | void
  paid_at     TEXT,
  paid_method TEXT,               -- Cash, Venmo, Zelle, Check, Card, Other
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bills_email ON bills(email, status);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status, id);

-- ───────── Small site settings (e.g. the secret calendar-feed link) ─────────
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
