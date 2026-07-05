import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

fs.mkdirSync(config.dataDir, { recursive: true });

export const db = new Database(path.join(config.dataDir, "smart-esb.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS flows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_json TEXT NOT NULL,
    destination_json TEXT NOT NULL,
    mapping_json TEXT,
    schedule TEXT,
    template_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS flow_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flow_id TEXT NOT NULL,
    flow_name TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    received INTEGER NOT NULL,
    success INTEGER NOT NULL,
    failed INTEGER NOT NULL,
    errors_json TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_flow_runs_flow_id ON flow_runs (flow_id, id);
  CREATE INDEX IF NOT EXISTS idx_flow_runs_timestamp ON flow_runs (timestamp);

  CREATE TABLE IF NOT EXISTS watermarks (
    flow_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    last_value TEXT NOT NULL,
    PRIMARY KEY (flow_id, table_name)
  );

  -- 데모/템플릿용 예시 업무 테이블 (DB 폴링 연계 템플릿에서 사용)
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT NOT NULL,
    customer TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'NEW',
    created_at TEXT NOT NULL
  );
`);

function seedDemoOrdersIfEmpty(): void {
  const { count } = db.prepare("SELECT COUNT(*) as count FROM orders").get() as { count: number };
  if (count > 0) return;
  const insert = db.prepare(
    "INSERT INTO orders (order_no, customer, amount, status, created_at) VALUES (@order_no, @customer, @amount, @status, @created_at)",
  );
  const now = new Date().toISOString();
  const seed = [
    { order_no: "ORD-2001", customer: "(주)한빛물산", amount: 128000, status: "NEW", created_at: now },
    { order_no: "ORD-2002", customer: "대성유통", amount: 54000, status: "NEW", created_at: now },
    { order_no: "ORD-2003", customer: "청년마트", amount: 231000, status: "NEW", created_at: now },
  ];
  for (const row of seed) insert.run(row);
}
seedDemoOrdersIfEmpty();
