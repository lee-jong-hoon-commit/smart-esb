import { db } from "../db/index.js";
import type {
  ConnectorStats,
  ConnectorStatsPage,
  ConnectorType,
  DbConfig,
  FileConfig,
  HttpConfig,
  InterfaceRegistryEntry,
  QueueConfig,
  ScheduleStatus,
} from "./connectorTypes.js";
import { listInterfacesPage } from "./interfaceRegistry.js";

const DEFAULT_HTTP_TIMEOUT_MS = 1000;
const SCHEDULE_DELAY_GRACE_FACTOR = 1.5;

function todayRangeIso(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return { from: start.toISOString(), to: now.toISOString() };
}

interface TodayAgg {
  todayCount: number;
  todaySuccess: number;
  todayFailed: number;
  failureRatePct: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  lastRunAt: string | null;
}

function aggregateToday(interfaceId: string): TodayAgg {
  const { from, to } = todayRangeIso();
  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(record_count), 0) as recordCount,
         COALESCE(SUM(failed_count), 0) as failedCount,
         COALESCE(AVG(duration_ms), 0) as avgDurationMs,
         COALESCE(MIN(duration_ms), 0) as minDurationMs,
         COALESCE(MAX(duration_ms), 0) as maxDurationMs,
         MAX(started_at) as lastRunAt
       FROM interface_runs
       WHERE interface_id = ? AND started_at >= ? AND started_at <= ?`,
    )
    .get(interfaceId, from, to) as {
    recordCount: number;
    failedCount: number;
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    lastRunAt: string | null;
  };

  return {
    todayCount: row.recordCount,
    todaySuccess: row.recordCount - row.failedCount,
    todayFailed: row.failedCount,
    failureRatePct: row.recordCount > 0 ? Math.round((row.failedCount / row.recordCount) * 1000) / 10 : 0,
    avgDurationMs: Math.round(row.avgDurationMs),
    minDurationMs: row.minDurationMs,
    maxDurationMs: row.maxDurationMs,
    lastRunAt: row.lastRunAt,
  };
}

function recentErrors(interfaceId: string, limit = 3): string[] {
  const { from, to } = todayRangeIso();
  const rows = db
    .prepare(
      `SELECT error_detail FROM interface_runs
       WHERE interface_id = ? AND started_at >= ? AND started_at <= ? AND error_detail IS NOT NULL
       ORDER BY started_at DESC LIMIT 20`,
    )
    .all(interfaceId, from, to) as { error_detail: string }[];

  const distinct: string[] = [];
  for (const row of rows) {
    if (!distinct.includes(row.error_detail)) distinct.push(row.error_detail);
    if (distinct.length >= limit) break;
  }
  return distinct;
}

// 백로그(적체 건수): 오늘 실패해서 아직 재전송되지 않은 레코드 수를 큐에 쌓여있는 것으로 간주합니다.
function backlogInfo(interfaceId: string): { backlogCount: number; oldestBacklogAgeSec: number | null } {
  const { from, to } = todayRangeIso();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(failed_count), 0) as failedCount, MIN(started_at) as oldest FROM interface_runs
       WHERE interface_id = ? AND started_at >= ? AND started_at <= ? AND failed_count > 0`,
    )
    .get(interfaceId, from, to) as { failedCount: number; oldest: string | null };

  return {
    backlogCount: row.failedCount,
    oldestBacklogAgeSec: row.oldest ? Math.round((Date.now() - new Date(row.oldest).getTime()) / 1000) : null,
  };
}

function slowRunRatePct(interfaceId: string, timeoutMs: number): number {
  const { from, to } = todayRangeIso();
  const row = db
    .prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN duration_ms > ? THEN 1 ELSE 0 END) as slow
       FROM interface_runs WHERE interface_id = ? AND started_at >= ? AND started_at <= ?`,
    )
    .get(timeoutMs, interfaceId, from, to) as { total: number; slow: number | null };
  return row.total > 0 ? Math.round(((row.slow ?? 0) / row.total) * 1000) / 10 : 0;
}

function computeScheduleStatus(lastRunAt: string | null, pollIntervalSec: number | undefined): ScheduleStatus {
  if (!pollIntervalSec) return "알수없음";
  if (!lastRunAt) return "지연";
  const elapsedSec = (Date.now() - new Date(lastRunAt).getTime()) / 1000;
  return elapsedSec <= pollIntervalSec * SCHEDULE_DELAY_GRACE_FACTOR ? "정상" : "지연";
}

function buildStats(iface: InterfaceRegistryEntry): ConnectorStats {
  const agg = aggregateToday(iface.interfaceId);
  const base = { interfaceId: iface.interfaceId, interfaceName: iface.interfaceName, ...agg, recentErrors: recentErrors(iface.interfaceId) };

  switch (iface.connectorType) {
    case "QUEUE": {
      const config = iface.config as QueueConfig;
      const { backlogCount, oldestBacklogAgeSec } = backlogInfo(iface.interfaceId);
      return {
        ...base,
        connectorType: "QUEUE",
        source: config.source,
        destination: config.destination,
        queueName: config.queueName,
        backlogCount,
        oldestBacklogAgeSec,
        status: backlogCount > 0 ? "지연" : "정상",
      };
    }
    case "HTTP": {
      const config = iface.config as HttpConfig;
      const timeoutMs = config.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS;
      return {
        ...base,
        connectorType: "HTTP",
        url: config.url,
        method: config.method,
        serviceIp: config.serviceIp,
        timeoutMs,
        slowRunRatePct: slowRunRatePct(iface.interfaceId, timeoutMs),
      };
    }
    case "DB": {
      const config = iface.config as DbConfig;
      return {
        ...base,
        connectorType: "DB",
        table: config.table,
        watermarkColumn: config.watermarkColumn,
        pollIntervalSec: config.pollIntervalSec,
        scheduleStatus: computeScheduleStatus(agg.lastRunAt, config.pollIntervalSec),
      };
    }
    case "FILE": {
      const config = iface.config as FileConfig;
      return {
        ...base,
        connectorType: "FILE",
        path: config.path,
        pollIntervalSec: config.pollIntervalSec,
        scheduleStatus: computeScheduleStatus(agg.lastRunAt, config.pollIntervalSec),
      };
    }
  }
}

export async function getConnectorStatsPage(
  connectorType: ConnectorType | undefined,
  page = 1,
  pageSize = 20,
  search?: string,
): Promise<ConnectorStatsPage> {
  const ifacePage = await listInterfacesPage(connectorType, page, pageSize, search);
  return {
    rows: ifacePage.rows.map(buildStats),
    page: ifacePage.page,
    pageSize: ifacePage.pageSize,
    total: ifacePage.total,
    totalPages: ifacePage.totalPages,
  };
}
