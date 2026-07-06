import { db } from "../db/index.js";
import type {
  ConnectorStats,
  DbConfig,
  FileConfig,
  HttpConfig,
  QueueConfig,
} from "./connectorTypes.js";
import { listInterfaces } from "./interfaceRegistry.js";

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
  avgDurationMs: number;
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
         MAX(started_at) as lastRunAt
       FROM interface_runs
       WHERE interface_id = ? AND started_at >= ? AND started_at <= ?`,
    )
    .get(interfaceId, from, to) as {
    recordCount: number;
    failedCount: number;
    avgDurationMs: number;
    lastRunAt: string | null;
  };

  return {
    todayCount: row.recordCount,
    todaySuccess: row.recordCount - row.failedCount,
    todayFailed: row.failedCount,
    avgDurationMs: Math.round(row.avgDurationMs),
    lastRunAt: row.lastRunAt,
  };
}

// 백로그(적체 건수): 오늘 실패해서 아직 재전송되지 않은 레코드 수를 큐에 쌓여있는 것으로 간주합니다.
// 재전송하면 해당 트랜잭션의 failed_count가 줄어들어 백로그도 함께 줄어듭니다.
function backlogCount(interfaceId: string): number {
  const { from, to } = todayRangeIso();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(failed_count), 0) as failedCount FROM interface_runs
       WHERE interface_id = ? AND started_at >= ? AND started_at <= ?`,
    )
    .get(interfaceId, from, to) as { failedCount: number };
  return row.failedCount;
}

export async function getConnectorStats(): Promise<ConnectorStats[]> {
  const interfaces = await listInterfaces();
  return interfaces.map((iface): ConnectorStats => {
    const agg = aggregateToday(iface.interfaceId);
    const base = { interfaceId: iface.interfaceId, interfaceName: iface.interfaceName, ...agg };

    switch (iface.connectorType) {
      case "QUEUE": {
        const config = iface.config as QueueConfig;
        const backlog = backlogCount(iface.interfaceId);
        return {
          ...base,
          connectorType: "QUEUE",
          source: config.source,
          destination: config.destination,
          queueName: config.queueName,
          backlogCount: backlog,
          status: backlog > 0 ? "지연" : "정상",
        };
      }
      case "HTTP": {
        const config = iface.config as HttpConfig;
        return { ...base, connectorType: "HTTP", url: config.url, method: config.method, serviceIp: config.serviceIp };
      }
      case "DB": {
        const config = iface.config as DbConfig;
        return { ...base, connectorType: "DB", table: config.table, watermarkColumn: config.watermarkColumn };
      }
      case "FILE": {
        const config = iface.config as FileConfig;
        return { ...base, connectorType: "FILE", path: config.path };
      }
    }
  });
}
