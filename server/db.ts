import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(import.meta.dirname, '..', 'leads.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      source TEXT NOT NULL DEFAULT 'manual',
      form_name TEXT DEFAULT '',
      ad_name TEXT DEFAULT '',
      property_interest TEXT DEFAULT '',
      budget TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      assigned_to TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS status_changes (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      synced_to_meta INTEGER DEFAULT 0,
      meta_response TEXT DEFAULT '',
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL
    );
  `);

  // No seed data — start with an empty database.
  // Users configure Meta connection, team, and forms via Settings UI.
}

export default db;