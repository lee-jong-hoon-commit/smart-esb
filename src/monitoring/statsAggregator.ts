import { db } from "../db/index.js";

export interface DailyStat {
  date: string;
  count: number;
  success: number;
  failed: number;
}

export interface DailyStatsResult {
  bucket: "day" | "week";
  series: DailyStat[];
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

export interface InterfaceStatsPage {
  rows: InterfaceStat[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const WEEKLY_BUCKET_THRESHOLD_DAYS = 31;

function startOfDaysAgo(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

// 일자별 통계: days가 커지면(31일 초과) 막대가 수십~수백 개로 찌그러지는 것을 막기 위해
// 자동으로 7일 단위 주간 버킷으로 묶어서 반환합니다. 차트가 항상 관리 가능한 개수(≤ 약 30개)의
// 막대만 그리도록 보장하는 것이 목적입니다.
export async function getDailyStats(days = 7): Promise<DailyStatsResult> {
  const fromIso = startOfDaysAgo(days - 1).toISOString();

  const rows = db
    .prepare(
      `SELECT date(started_at) as date,
              COALESCE(SUM(record_count), 0) as count,
              COALESCE(SUM(failed_count), 0) as failed
       FROM interface_runs
       WHERE started_at >= ?
       GROUP BY date(started_at)`,
    )
    .all(fromIso) as { date: string; count: number; failed: number }[];

  // 데이터가 없는 날짜도 0으로 채워서 항상 days개의 연속된 항목을 만듭니다 (그래프가 끊기지 않도록).
  const rowMap = new Map(rows.map((r) => [r.date, r]));
  const daily: DailyStat[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = startOfDaysAgo(i).toISOString().slice(0, 10);
    const row = rowMap.get(key);
    const count = row?.count ?? 0;
    const failed = row?.failed ?? 0;
    daily.push({ date: key, count, success: count - failed, failed });
  }

  if (days <= WEEKLY_BUCKET_THRESHOLD_DAYS) {
    return { bucket: "day", series: daily };
  }

  const weekly: DailyStat[] = [];
  for (let i = 0; i < daily.length; i += 7) {
    const chunk = daily.slice(i, i + 7);
    const count = chunk.reduce((sum, d) => sum + d.count, 0);
    const failed = chunk.reduce((sum, d) => sum + d.failed, 0);
    const label = chunk.length > 1 ? `${chunk[0].date}~${chunk[chunk.length - 1].date}` : chunk[0].date;
    weekly.push({ date: label, count, success: count - failed, failed });
  }
  return { bucket: "week", series: weekly };
}

// 커넥터 타입은 QUEUE/HTTP/DB/FILE(+UNKNOWN)로 종류가 고정돼 있어 규모가 커져도 안전합니다.
export async function getConnectorTypeStats(days = 7): Promise<ConnectorTypeStat[]> {
  const fromIso = startOfDaysAgo(days - 1).toISOString();
  const rows = db
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
  return rows.map((r) => ({ ...r, success: r.count - r.failed }));
}

// 인터페이스는 수천~수만 개로 늘어날 수 있으므로, 전부 한 번에 내려주지 않고
// SQL 단에서 검색(LIKE)과 페이지네이션(LIMIT/OFFSET)을 적용합니다.
export async function getInterfaceStatsPage(
  days = 7,
  page = 1,
  pageSize = 20,
  search?: string,
): Promise<InterfaceStatsPage> {
  const fromIso = startOfDaysAgo(days - 1).toISOString();
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * pageSize;
  const searchFilter = search?.trim() ? `%${search.trim()}%` : null;

  const whereClause = searchFilter ? "r.started_at >= ? AND r.interface_name LIKE ?" : "r.started_at >= ?";
  const params: (string | number)[] = searchFilter ? [fromIso, searchFilter] : [fromIso];

  const totalRow = db
    .prepare(
      `SELECT COUNT(*) as total FROM (
         SELECT r.interface_id FROM interface_runs r WHERE ${whereClause} GROUP BY r.interface_id
       )`,
    )
    .get(...params) as { total: number };

  const rows = db
    .prepare(
      `SELECT r.interface_id as interfaceId, r.interface_name as interfaceName,
              COALESCE(i.connector_type, 'UNKNOWN') as connectorType,
              COALESCE(SUM(r.record_count), 0) as count,
              COALESCE(SUM(r.failed_count), 0) as failed
       FROM interface_runs r
       LEFT JOIN interfaces i ON i.interface_id = r.interface_id
       WHERE ${whereClause}
       GROUP BY r.interface_id, r.interface_name
       ORDER BY count DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset) as {
    interfaceId: string;
    interfaceName: string;
    connectorType: string;
    count: number;
    failed: number;
  }[];

  return {
    rows: rows.map((r) => ({ ...r, success: r.count - r.failed })),
    page: safePage,
    pageSize,
    total: totalRow.total,
    totalPages: Math.max(1, Math.ceil(totalRow.total / pageSize)),
  };
}
