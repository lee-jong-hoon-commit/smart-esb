import { db } from "../db/index.js";
import type { InterfaceErrorSummary, InterfaceRunDetail, InterfaceRunSummary, RunRecord } from "./types.js";

interface RunRow {
  transaction_id: string;
  interface_id: string;
  interface_name: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  record_count: number;
  result: string;
  error_detail: string | null;
  records_json: string | null;
}

function rowToSummary(row: RunRow): InterfaceRunSummary {
  return {
    transactionId: row.transaction_id,
    interfaceId: row.interface_id,
    interfaceName: row.interface_name,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    recordCount: row.record_count,
    result: row.result as InterfaceRunSummary["result"],
    errorDetail: row.error_detail,
  };
}

export interface RecordRunInput {
  transactionId: string;
  interfaceId: string;
  interfaceName: string;
  startedAt: string;
  endedAt: string;
  recordCount: number;
  result: InterfaceRunSummary["result"];
  errorDetail: string | null;
  records?: RunRecord[];
}

export async function recordRun(input: RecordRunInput): Promise<void> {
  const durationMs = new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime();
  db.prepare(
    `INSERT INTO interface_runs
      (transaction_id, interface_id, interface_name, started_at, ended_at, duration_ms, record_count, result, error_detail, records_json)
     VALUES (@transactionId, @interfaceId, @interfaceName, @startedAt, @endedAt, @durationMs, @recordCount, @result, @errorDetail, @recordsJson)`,
  ).run({
    transactionId: input.transactionId,
    interfaceId: input.interfaceId,
    interfaceName: input.interfaceName,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs,
    recordCount: input.recordCount,
    result: input.result,
    errorDetail: input.errorDetail,
    recordsJson: input.records ? JSON.stringify(input.records) : null,
  });
}

export async function getRecentRuns(limit = 50, interfaceId?: string): Promise<InterfaceRunSummary[]> {
  const rows = interfaceId
    ? (db
        .prepare("SELECT * FROM interface_runs WHERE interface_id = ? ORDER BY started_at DESC LIMIT ?")
        .all(interfaceId, limit) as RunRow[])
    : (db.prepare("SELECT * FROM interface_runs ORDER BY started_at DESC LIMIT ?").all(limit) as RunRow[]);
  return rows.map(rowToSummary);
}

export interface RunsPage {
  rows: InterfaceRunSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export async function getRunsPage(page: number, pageSize: number, interfaceId?: string): Promise<RunsPage> {
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * pageSize;

  const total = interfaceId
    ? (db.prepare("SELECT COUNT(*) as count FROM interface_runs WHERE interface_id = ?").get(interfaceId) as {
        count: number;
      }).count
    : (db.prepare("SELECT COUNT(*) as count FROM interface_runs").get() as { count: number }).count;

  const rows = interfaceId
    ? (db
        .prepare("SELECT * FROM interface_runs WHERE interface_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?")
        .all(interfaceId, pageSize, offset) as RunRow[])
    : (db
        .prepare("SELECT * FROM interface_runs ORDER BY started_at DESC LIMIT ? OFFSET ?")
        .all(pageSize, offset) as RunRow[]);

  return {
    rows: rows.map(rowToSummary),
    page: safePage,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getRunDetail(transactionId: string): Promise<InterfaceRunDetail | undefined> {
  const row = db.prepare("SELECT * FROM interface_runs WHERE transaction_id = ?").get(transactionId) as
    | RunRow
    | undefined;
  if (!row) return undefined;
  return { ...rowToSummary(row), records: row.records_json ? JSON.parse(row.records_json) : [] };
}

export async function getRunsInRange(fromIso: string, toIso: string): Promise<InterfaceRunSummary[]> {
  const rows = db
    .prepare("SELECT * FROM interface_runs WHERE started_at >= ? AND started_at <= ? ORDER BY started_at ASC")
    .all(fromIso, toIso) as RunRow[];
  return rows.map(rowToSummary);
}

export async function summarizeRange(fromIso: string, toIso: string): Promise<InterfaceErrorSummary[]> {
  const runs = await getRunsInRange(fromIso, toIso);
  const byInterface = new Map<string, InterfaceErrorSummary>();
  for (const run of runs) {
    let summary = byInterface.get(run.interfaceId);
    if (!summary) {
      summary = {
        interfaceId: run.interfaceId,
        interfaceName: run.interfaceName,
        runs: 0,
        recordCount: 0,
        successRuns: 0,
        partialRuns: 0,
        failedRuns: 0,
        sampleErrors: [],
      };
      byInterface.set(run.interfaceId, summary);
    }
    summary.runs += 1;
    summary.recordCount += run.recordCount;
    if (run.result === "SUCCESS") summary.successRuns += 1;
    else if (run.result === "PARTIAL") summary.partialRuns += 1;
    else summary.failedRuns += 1;
    if (run.errorDetail && summary.sampleErrors.length < 5 && !summary.sampleErrors.includes(run.errorDetail)) {
      summary.sampleErrors.push(run.errorDetail);
    }
  }
  return [...byInterface.values()].sort((a, b) => b.failedRuns + b.partialRuns - (a.failedRuns + a.partialRuns));
}
