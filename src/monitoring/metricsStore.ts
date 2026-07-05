import { db } from "../db/index.js";
import type { FlowRunMetric } from "./types.js";

interface FlowRunRow {
  flow_id: string;
  timestamp: string;
  duration_ms: number;
  received: number;
  success: number;
  failed: number;
  filtered: number;
}

function rowToMetric(row: FlowRunRow): FlowRunMetric {
  return {
    flowId: row.flow_id,
    timestamp: row.timestamp,
    durationMs: row.duration_ms,
    received: row.received,
    success: row.success,
    failed: row.failed,
    filtered: row.filtered,
  };
}

export async function recordRun(metric: FlowRunMetric): Promise<void> {
  db.prepare(
    `INSERT INTO flow_runs (flow_id, timestamp, duration_ms, received, success, failed, filtered)
     VALUES (@flowId, @timestamp, @durationMs, @received, @success, @failed, @filtered)`,
  ).run({ filtered: 0, ...metric });
}

export async function getHistory(flowId: string, limit = 500): Promise<FlowRunMetric[]> {
  const rows = db
    .prepare("SELECT * FROM flow_runs WHERE flow_id = ? ORDER BY id DESC LIMIT ?")
    .all(flowId, limit) as FlowRunRow[];
  return rows.map(rowToMetric).reverse();
}

export async function getAllFlowIds(): Promise<string[]> {
  const rows = db.prepare("SELECT DISTINCT flow_id FROM flow_runs").all() as { flow_id: string }[];
  return rows.map((r) => r.flow_id);
}
