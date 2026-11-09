import { DatabaseSync } from 'node:sqlite';
import { DB_PATH, ensureDirs } from './config.js';

let db;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,                 -- gmail | microsoft | imap | pop3
  email TEXT NOT NULL,
  display_name TEXT,                  -- name used on outgoing mail
  label TEXT,                         -- short name shown in the app ("Work", "Personal")
  color TEXT,
  config TEXT NOT NULL DEFAULT '{}',  -- server settings (no secrets)
  secrets TEXT,                       -- encrypted: passwords, OAuth tokens
  sync_state TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new', -- new | syncing | ok | error | auth_error
  last_error TEXT,
  last_sync_at TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  signature TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  remote_id TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT,
  role TEXT,                          -- inbox | sent | drafts | trash | junk | archive | null
  parent_remote_id TEXT,
  sync_state TEXT NOT NULL DEFAULT '{}',
  unread_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  local_only INTEGER NOT NULL DEFAULT 0,
  UNIQUE(account_id, remote_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  remote_id TEXT NOT NULL,
  message_id TEXT,
  in_reply_to TEXT,
  refs TEXT,
  thread_key TEXT,
  subject TEXT,
  from_name TEXT,
  from_addr TEXT,
  to_json TEXT,
  cc_json TEXT,
  bcc_json TEXT,
  reply_to_json TEXT,
  date TEXT,
  snippet TEXT,
  seen INTEGER NOT NULL DEFAULT 0,
  flagged INTEGER NOT NULL DEFAULT 0,
  answered INTEGER NOT NULL DEFAULT 0,
  has_attachments INTEGER NOT NULL DEFAULT 0,
  size INTEGER,
  body_state INTEGER NOT NULL DEFAULT 0, -- 0 = headers only, 1 = body cached
  body_text TEXT,
  body_html TEXT,
  attachments_json TEXT,
  has_invite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(folder_id, remote_id)
);
CREATE INDEX IF NOT EXISTS idx_messages_folder_date ON messages(folder_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_messages_date ON messages(date DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(account_id, thread_key);
CREATE INDEX IF NOT EXISTS idx_messages_remote ON messages(account_id, remote_id);
CREATE INDEX IF NOT EXISTS idx_messages_msgid ON messages(message_id);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  subject, people, body, tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, subject, people, body)
  VALUES (new.id, coalesce(new.subject,''),
          coalesce(new.from_name,'') || ' ' || coalesce(new.from_addr,'') || ' ' || coalesce(new.to_json,'') || ' ' || coalesce(new.cc_json,''),
          coalesce(substr(new.body_text, 1, 200000), new.snippet, ''));
END;
CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  DELETE FROM messages_fts WHERE rowid = old.id;
END;
CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE OF subject, from_name, from_addr, to_json, cc_json, body_text, snippet ON messages BEGIN
  DELETE FROM messages_fts WHERE rowid = old.id;
  INSERT INTO messages_fts(rowid, subject, people, body)
  VALUES (new.id, coalesce(new.subject,''),
          coalesce(new.from_name,'') || ' ' || coalesce(new.from_addr,'') || ' ' || coalesce(new.to_json,'') || ' ' || coalesce(new.cc_json,''),
          coalesce(substr(new.body_text, 1, 200000), new.snippet, ''));
END;

CREATE TABLE IF NOT EXISTS calendars (
  id INTEGER PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE, -- null for local/subscribed calendars
  remote_id TEXT,
  name TEXT NOT NULL,
  color TEXT,
  kind TEXT NOT NULL DEFAULT 'remote',  -- remote | local | ics
  url TEXT,
  visible INTEGER NOT NULL DEFAULT 1,
  read_only INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  sync_state TEXT NOT NULL DEFAULT '{}',
  last_error TEXT,
  UNIQUE(account_id, remote_id)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  calendar_id INTEGER NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  remote_id TEXT,
  uid TEXT,
  title TEXT,
  description TEXT,
  location TEXT,
  start TEXT NOT NULL,       -- ISO-8601 UTC instant
  end TEXT NOT NULL,         -- ISO-8601 UTC instant
  all_day INTEGER NOT NULL DEFAULT 0,
  start_date TEXT,           -- YYYY-MM-DD for all-day events
  end_date TEXT,             -- YYYY-MM-DD, exclusive
  timezone TEXT,
  attendees_json TEXT,
  organizer TEXT,
  status TEXT,
  show_as TEXT,
  recurring INTEGER NOT NULL DEFAULT 0,
  series_id TEXT,
  reminder_minutes INTEGER,
  web_link TEXT,
  online_meeting_url TEXT,
  source_message_id INTEGER,
  created_by TEXT,
  etag TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(calendar_id, remote_id)
);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start);
CREATE INDEX IF NOT EXISTS idx_events_end ON events(end);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT,
  phone TEXT,
  company TEXT,
  notes TEXT,
  times_sent INTEGER NOT NULL DEFAULT 0,
  times_received INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT,
  manual INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS drafts (
  id INTEGER PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  to_json TEXT, cc_json TEXT, bcc_json TEXT,
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  reply_to_message_id INTEGER,
  forward_message_id INTEGER,
  attachments_json TEXT,
  created_by TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY,
  title TEXT,
  messages_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE, -- null = every account
  match TEXT NOT NULL DEFAULT 'all',  -- all | any
  conditions_json TEXT NOT NULL DEFAULT '[]',
  actions_json TEXT NOT NULL DEFAULT '[]',
  stop INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  times_applied INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT 'you',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL,
  send_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | sending | sent | failed | canceled
  error TEXT,
  created_by TEXT NOT NULL DEFAULT 'you',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_outbox_due ON outbox(status, send_at);

CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY,
  ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actor TEXT NOT NULL,       -- you | claude (app) | claude (mcp) | sync
  action TEXT NOT NULL,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity(ts DESC);
`;

// Columns added after the first release; applied to existing databases on open.
const MIGRATIONS = [
  ['events', 'rrule', 'TEXT'],         // recurrence rule of the series this event belongs to
  ['events', 'href', 'TEXT'],          // CalDAV resource URL
  ['drafts', 'server_ref', 'TEXT'],    // where the draft is mirrored on the mail server
  ['drafts', 'send_at', 'TEXT'],
];

export function openDb(file = DB_PATH) {
  if (db) return db;
  ensureDirs();
  db = new DatabaseSync(file);
  db.exec(SCHEMA);
  for (const [table, col, type] of MIGRATIONS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  }
  return db;
}

export function getDb() {
  return db || openDb();
}

export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}

// Small helpers --------------------------------------------------------------

export function all(sql, ...params) {
  return getDb().prepare(sql).all(...params.map(norm));
}
export function get(sql, ...params) {
  return getDb().prepare(sql).get(...params.map(norm));
}
export function run(sql, ...params) {
  return getDb().prepare(sql).run(...params.map(norm));
}

function norm(v) {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  return v;
}

export function tx(fn) {
  const d = getDb();
  d.exec('BEGIN');
  try {
    const r = fn();
    d.exec('COMMIT');
    return r;
  } catch (e) {
    try { d.exec('ROLLBACK'); } catch {}
    throw e;
  }
}

export function json(text, fallback = null) {
  if (text == null || text === '') return fallback;
  try { return JSON.parse(text); } catch { return fallback; }
}

export function getSetting(key, fallback = null) {
  const row = get('SELECT value FROM settings WHERE key = ?', key);
  return row ? json(row.value, fallback) : fallback;
}

export function setSetting(key, value) {
  run('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, JSON.stringify(value));
}

export function logActivity(actor, action, detail) {
  run('INSERT INTO activity(actor, action, detail) VALUES(?, ?, ?)', actor, action, typeof detail === 'string' ? detail : JSON.stringify(detail ?? null));
  run("DELETE FROM activity WHERE id < (SELECT max(id) - 2000 FROM activity)");
}
