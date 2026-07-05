import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import type { Message } from "../core/types.js";
import type { DestinationConnector, SourceConnector } from "./types.js";

function getWatermark(flowId: string, table: string): string | null {
  const row = db.prepare("SELECT last_value FROM watermarks WHERE flow_id = ? AND table_name = ?").get(flowId, table) as
    | { last_value: string }
    | undefined;
  return row?.last_value ?? null;
}

function setWatermark(flowId: string, table: string, value: string): void {
  db.prepare(
    `INSERT INTO watermarks (flow_id, table_name, last_value) VALUES (?, ?, ?)
     ON CONFLICT(flow_id, table_name) DO UPDATE SET last_value = excluded.last_value`,
  ).run(flowId, table, value);
}

function toBoundValue(raw: string): string | number {
  const n = Number(raw);
  return Number.isNaN(n) ? raw : n;
}

// DB 폴링 연계: watermarkColumn(주로 증가하는 id) 기준으로 이전 실행 이후 새로 생긴 행만 조회.
// 테이블/컬럼명은 core/types.ts의 identifier 정규식으로 이미 검증된 값만 여기 도달합니다.
export function createDbSource(
  flowId: string,
  table: string,
  watermarkColumn: string,
  filter?: { column: string; equals: string | number | boolean },
): SourceConnector {
  return {
    async receive(): Promise<Message[]> {
      const lastValue = getWatermark(flowId, table);
      const whereClauses = [`${watermarkColumn} > ?`];
      const params: (string | number | boolean)[] = [lastValue === null ? -1 : toBoundValue(lastValue)];
      if (filter) {
        whereClauses.push(`${filter.column} = ?`);
        params.push(filter.equals);
      }
      const sql = `SELECT * FROM ${table} WHERE ${whereClauses.join(" AND ")} ORDER BY ${watermarkColumn} ASC LIMIT 200`;
      const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
      if (rows.length > 0) {
        setWatermark(flowId, table, String(rows[rows.length - 1][watermarkColumn]));
      }
      return rows.map((payload) => ({ id: randomUUID(), timestamp: new Date().toISOString(), payload }));
    },
  };
}

export function createDbDestination(table: string): DestinationConnector {
  return {
    async send(message: Message): Promise<void> {
      const payload = message.payload;
      if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        throw new Error("DB 목적지는 객체(JSON) 형태의 페이로드만 지원합니다.");
      }
      const entries = Object.entries(payload as Record<string, unknown>);
      for (const [col] of entries) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(col)) {
          throw new Error(`유효하지 않은 컬럼명: ${col}`);
        }
      }
      const columns = entries.map(([k]) => k);
      const values = entries.map(([, v]) => (typeof v === "object" && v !== null ? JSON.stringify(v) : v));
      const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
      db.prepare(sql).run(...(values as (string | number | boolean | null)[]));
    },
  };
}
