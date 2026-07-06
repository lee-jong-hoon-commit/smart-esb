import { db } from "../db/index.js";
import type { ConnectorConfig, ConnectorType, InterfaceRegistryEntry } from "./connectorTypes.js";

interface InterfaceRow {
  interface_id: string;
  interface_name: string;
  connector_type: string;
  config_json: string;
  created_at: string;
}

function rowToEntry(row: InterfaceRow): InterfaceRegistryEntry {
  return {
    interfaceId: row.interface_id,
    interfaceName: row.interface_name,
    connectorType: row.connector_type as ConnectorType,
    config: JSON.parse(row.config_json),
    createdAt: row.created_at,
  };
}

export interface UpsertInterfaceInput {
  interfaceId: string;
  interfaceName: string;
  connectorType: ConnectorType;
  config: ConnectorConfig;
}

export async function upsertInterface(input: UpsertInterfaceInput): Promise<void> {
  db.prepare(
    `INSERT INTO interfaces (interface_id, interface_name, connector_type, config_json, created_at)
     VALUES (@interfaceId, @interfaceName, @connectorType, @configJson, @createdAt)
     ON CONFLICT(interface_id) DO UPDATE SET
       interface_name = excluded.interface_name,
       connector_type = excluded.connector_type,
       config_json = excluded.config_json`,
  ).run({
    interfaceId: input.interfaceId,
    interfaceName: input.interfaceName,
    connectorType: input.connectorType,
    configJson: JSON.stringify(input.config),
    createdAt: new Date().toISOString(),
  });
}

export async function listInterfaces(): Promise<InterfaceRegistryEntry[]> {
  const rows = db.prepare("SELECT * FROM interfaces ORDER BY interface_name ASC").all() as InterfaceRow[];
  return rows.map(rowToEntry);
}

export interface InterfaceRegistryPage {
  rows: InterfaceRegistryEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// 커넥터 타입별로 인터페이스가 수천~수만 개로 늘어날 수 있으므로, 전체를 내려주지 않고
// SQL 단에서 타입 필터 + 이름 검색(LIKE) + 페이지네이션(LIMIT/OFFSET)을 적용합니다.
export async function listInterfacesPage(
  connectorType: ConnectorType,
  page = 1,
  pageSize = 20,
  search?: string,
): Promise<InterfaceRegistryPage> {
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * pageSize;
  const searchFilter = search?.trim() ? `%${search.trim()}%` : null;

  const whereClause = searchFilter ? "connector_type = ? AND interface_name LIKE ?" : "connector_type = ?";
  const params: (string | number)[] = searchFilter ? [connectorType, searchFilter] : [connectorType];

  const totalRow = db.prepare(`SELECT COUNT(*) as total FROM interfaces WHERE ${whereClause}`).get(...params) as {
    total: number;
  };
  const rows = db
    .prepare(`SELECT * FROM interfaces WHERE ${whereClause} ORDER BY interface_name ASC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as InterfaceRow[];

  return {
    rows: rows.map(rowToEntry),
    page: safePage,
    pageSize,
    total: totalRow.total,
    totalPages: Math.max(1, Math.ceil(totalRow.total / pageSize)),
  };
}

export async function getInterface(interfaceId: string): Promise<InterfaceRegistryEntry | undefined> {
  const row = db.prepare("SELECT * FROM interfaces WHERE interface_id = ?").get(interfaceId) as
    | InterfaceRow
    | undefined;
  return row ? rowToEntry(row) : undefined;
}
