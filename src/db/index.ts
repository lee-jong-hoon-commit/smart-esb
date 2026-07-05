import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

fs.mkdirSync(config.dataDir, { recursive: true });

export const db = new Database(path.join(config.dataDir, "smart-esb.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS interface_runs (
    transaction_id TEXT PRIMARY KEY,
    interface_id TEXT NOT NULL,
    interface_name TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    record_count INTEGER NOT NULL,
    result TEXT NOT NULL,
    error_detail TEXT,
    records_json TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_interface_runs_interface ON interface_runs (interface_id, started_at);
  CREATE INDEX IF NOT EXISTS idx_interface_runs_started_at ON interface_runs (started_at);
`);
