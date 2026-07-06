import { db } from "../db/index.js";

export interface DailyStat {
  date: string;
  count: number;
  success: number;
  failed: number;
}

export interface ConnectorTypeStat {
  connectorType: string;
  count: number;
  success: number;
  failed: number;
}

export interface InterfaceStat {
  interfaceId: string;
  interfaceName: string;
  connectorType: string;
  count: number;
  success: number;
  failed: number;
}

export interface StatsResult {
  days: number;
  daily: DailyStat[];
  byConnectorType: ConnectorTypeStat[];
  byInterface: InterfaceStat[];
}

function startOfDaysAgo(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

export async function getStats(days = 7): Promise<StatsResult> {
  const fromIso = startOfDaysAgo(days - 1).toISOString();

  const dailyRows = db
    .prepare(
      `SELECT date(started_at) as date,
              COALESCE(SUM(record_count), 0) as count,
              COALESCE(SUM(failed_count), 0) as failed
       FROM interface_runs
       WHERE started_at >= ?
       GROUP BY date(started_at)`,
    )
    .all(fromIso) as { date: string; count: number; failed: number }[];

  // 데이터가 없는 날짜도 0으로 채워서 항상 days개의 연속된 항목을 반환합니다 (그래프가 끊기지 않도록).
  const dailyMap = new Map(dailyRows.map((r) => [r.date, r]));
  const daily: DailyStat[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = startOfDaysAgo(i).toISOString().slice(0, 10);
    const row = dailyMap.get(key);
    const count = row?.count ?? 0;
    const failed = row?.failed ?? 0;
    daily.push({ date: key, count, success: count - failed, failed });
  }

  const byConnectorTypeRows = db
    .prepare(
      `SELECT COALESCE(i.connector_type, 'UNKNOWN') as connectorType,
              COALESCE(SUM(r.record_count), 0) as count,
              COALESCE(SUM(r.failed_count), 0) as failed
       FROM interface_runs r
       LEFT JOIN interfaces i ON i.interface_id = r.interface_id
       WHERE r.started_at >= ?
       GROUP BY connectorType
       ORDER BY count DESC`,
    )
    .all(fromIso) as { connectorType: string; count: number; failed: number }[];

  const byInterfaceRows = db
    .prepare(
      `SELECT r.interface_id as interfaceId, r.interface_name as interfaceName,
              COALESCE(i.connector_type, 'UNKNOWN') as connectorType,
              COALESCE(SUM(r.record_count), 0) as count,
              COALESCE(SUM(r.failed_count), 0) as failed
       FROM interface_runs r
       LEFT JOIN interfaces i ON i.interface_id = r.interface_id
       WHERE r.started_at >= ?
       GROUP BY r.interface_id, r.interface_name
       ORDER BY count DESC`,
    )
    .all(fromIso) as { interfaceId: string; interfaceName: string; connectorType: string; count: number; failed: number }[];

  return {
    days,
    daily,
    byConnectorType: byConnectorTypeRows.map((r) => ({ ...r, success: r.count - r.failed })),
    byInterface: byInterfaceRows.map((r) => ({ ...r, success: r.count - r.failed })),
  };
}
