import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function openDb(filename = process.env.DATABASE_PATH || 'storage/tracker.sqlite') {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS projects (code TEXT PRIMARY KEY, name TEXT NOT NULL, client TEXT NOT NULL, budget INTEGER NOT NULL CHECK(budget>0));
    CREATE TABLE IF NOT EXISTS usage (
      source TEXT NOT NULL, source_id TEXT NOT NULL, project TEXT REFERENCES projects(code), raw_project TEXT NOT NULL,
      vendor TEXT NOT NULL, tool TEXT NOT NULL, occurred_at TEXT NOT NULL, amount INTEGER NOT NULL,
      reference TEXT, raw TEXT NOT NULL, status TEXT NOT NULL, duplicate_of TEXT, PRIMARY KEY(source,source_id)
    );
    CREATE TABLE IF NOT EXISTS assignments (source TEXT NOT NULL, source_id TEXT NOT NULL, project TEXT NOT NULL REFERENCES projects(code), PRIMARY KEY(source,source_id));
    CREATE TABLE IF NOT EXISTS imports (id INTEGER PRIMARY KEY, started_at TEXT NOT NULL, completed_at TEXT NOT NULL, summary TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS alerts (project TEXT PRIMARY KEY REFERENCES projects(code), status TEXT NOT NULL, payload TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, error TEXT, sent_at TEXT);
    CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY, received_at TEXT NOT NULL, payload TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS usage_project ON usage(project,status);
  `);
  return db;
}
