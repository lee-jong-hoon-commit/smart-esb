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
    failed_count INTEGER NOT NULL DEFAULT 0,
    result TEXT NOT NULL,
    error_detail TEXT,
    records_json TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_interface_runs_interface ON interface_runs (interface_id, started_at);
  CREATE INDEX IF NOT EXISTS idx_interface_runs_started_at ON interface_runs (started_at);

  CREATE TABLE IF NOT EXISTS interfaces (
    interface_id TEXT PRIMARY KEY,
    interface_name TEXT NOT NULL,
    connector_type TEXT NOT NULL,
    config_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shared_resources (
    resource_id TEXT PRIMARY KEY,
    resource_name TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    config_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS nodes (
    node_id TEXT PRIMARY KEY,
    node_name TEXT NOT NULL,
    node_type TEXT NOT NULL,
    host TEXT NOT NULL,
    config_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS node_heartbeats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,
    reported_at TEXT NOT NULL,
    status TEXT NOT NULL,
    cpu_pct REAL NOT NULL,
    mem_pct REAL NOT NULL,
    disk_pct REAL NOT NULL,
    uptime_sec INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_node_heartbeats_node ON node_heartbeats (node_id, reported_at);
`);

// CREATE TABLE IF NOT EXISTS는 이미 존재하는 테이블에 새 컬럼을 추가해주지 않으므로,
// 스키마가 바뀔 때마다 기존 DB 파일에 누락된 컬럼을 여기서 보강합니다.
function ensureColumn(table: string, column: string, addColumnDdl: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${addColumnDdl}`);
  }
}

ensureColumn("interface_runs", "failed_count", "failed_count INTEGER NOT NULL DEFAULT 0");
