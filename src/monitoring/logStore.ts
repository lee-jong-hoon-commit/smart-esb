import { db } from "../db/index.js";
import type { FlowErrorSummary, FlowRunLog } from "./types.js";

interface FlowRunRow {
  id: number;
  flow_id: string;
  flow_name: string;
  timestamp: string;
  duration_ms: number;
  received: number;
  success: number;
  failed: number;
  errors_json: string | null;
}

function rowToLog(row: FlowRunRow): FlowRunLog {
  return {
    id: row.id,
    flowId: row.flow_id,
    flowName: row.flow_name,
    timestamp: row.timestamp,
    durationMs: row.duration_ms,
    received: row.received,
    success: row.success,
    failed: row.failed,
    errors: row.errors_json ? JSON.parse(row.errors_json) : [],
  };
}

export interface RecordRunInput {
  flowId: string;
  flowName: string;
  timestamp: string;
  durationMs: number;
  received: number;
  success: number;
  failed: number;
  errors: string[];
}

export async function recordRun(input: RecordRunInput): Promise<void> {
  db.prepare(
    `INSERT INTO flow_runs (flow_id, flow_name, timestamp, duration_ms, received, success, failed, errors_json)
     VALUES (@flowId, @flowName, @timestamp, @durationMs, @received, @success, @failed, @errorsJson)`,
  ).run({
    flowId: input.flowId,
    flowName: input.flowName,
    timestamp: input.timestamp,
    durationMs: input.durationMs,
    received: input.received,
    success: input.success,
    failed: input.failed,
    errorsJson: input.errors.length ? JSON.stringify(input.errors) : null,
  });
}

export async function getRecentRuns(limit = 50, flowId?: string): Promise<FlowRunLog[]> {
  const rows = flowId
    ? (db
        .prepare("SELECT * FROM flow_runs WHERE flow_id = ? ORDER BY id DESC LIMIT ?")
        .all(flowId, limit) as FlowRunRow[])
    : (db.prepare("SELECT * FROM flow_runs ORDER BY id DESC LIMIT ?").all(limit) as FlowRunRow[]);
  return rows.map(rowToLog);
}

export async function getRunsInRange(fromIso: string, toIso: string): Promise<FlowRunLog[]> {
  const rows = db
    .prepare("SELECT * FROM flow_runs WHERE timestamp >= ? AND timestamp <= ? ORDER BY id ASC")
    .all(fromIso, toIso) as FlowRunRow[];
  return rows.map(rowToLog);
}

export async function summarizeRange(fromIso: string, toIso: string): Promise<FlowErrorSummary[]> {
  const runs = await getRunsInRange(fromIso, toIso);
  const byFlow = new Map<string, FlowErrorSummary>();
  for (const run of runs) {
    let summary = byFlow.get(run.flowId);
    if (!summary) {
      summary = { flowId: run.flowId, flowName: run.flowName, runs: 0, received: 0, success: 0, failed: 0, sampleErrors: [] };
      byFlow.set(run.flowId, summary);
    }
    summary.runs += 1;
    summary.received += run.received;
    summary.success += run.success;
    summary.failed += run.failed;
    for (const err of run.errors) {
      if (summary.sampleErrors.length < 5 && !summary.sampleErrors.includes(err)) {
        summary.sampleErrors.push(err);
      }
    }
  }
  return [...byFlow.values()].sort((a, b) => b.failed - a.failed);
}
