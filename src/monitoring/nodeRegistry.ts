import { db } from "../db/index.js";
import type { NodeConfig, NodeRegistryEntry, NodeRegistryPage, NodeType } from "./nodeTypes.js";

interface NodeRow {
  node_id: string;
  node_name: string;
  node_type: string;
  host: string;
  config_json: string;
  created_at: string;
}

function rowToEntry(row: NodeRow): NodeRegistryEntry {
  return {
    nodeId: row.node_id,
    nodeName: row.node_name,
    nodeType: row.node_type as NodeType,
    host: row.host,
    config: JSON.parse(row.config_json),
    createdAt: row.created_at,
  };
}

export interface UpsertNodeInput {
  nodeId: string;
  nodeName: string;
  nodeType: NodeType;
  host: string;
  config: NodeConfig;
}

export async function upsertNode(input: UpsertNodeInput): Promise<void> {
  db.prepare(
    `INSERT INTO nodes (node_id, node_name, node_type, host, config_json, created_at)
     VALUES (@nodeId, @nodeName, @nodeType, @host, @configJson, @createdAt)
     ON CONFLICT(node_id) DO UPDATE SET
       node_name = excluded.node_name,
       node_type = excluded.node_type,
       host = excluded.host,
       config_json = excluded.config_json`,
  ).run({
    nodeId: input.nodeId,
    nodeName: input.nodeName,
    nodeType: input.nodeType,
    host: input.host,
    configJson: JSON.stringify(input.config),
    createdAt: new Date().toISOString(),
  });
}

// 노드가 많아질 수 있다는 전제로, 타입 필터(선택) + ID/이름/호스트 검색(LIKE) +
// 페이지네이션(LIMIT/OFFSET)을 SQL 단에서 적용합니다. nodeType을 생략하면 전체를 검색합니다.
export async function listNodesPage(
  nodeType: NodeType | undefined,
  page = 1,
  pageSize = 20,
  search?: string,
): Promise<NodeRegistryPage> {
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * pageSize;
  const searchFilter = search?.trim() ? `%${search.trim()}%` : null;

  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (nodeType) {
    conditions.push("node_type = ?");
    params.push(nodeType);
  }
  if (searchFilter) {
    conditions.push("(node_name LIKE ? OR node_id LIKE ? OR host LIKE ?)");
    params.push(searchFilter, searchFilter, searchFilter);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const totalRow = db.prepare(`SELECT COUNT(*) as total FROM nodes ${whereClause}`).get(...params) as {
    total: number;
  };
  const rows = db
    .prepare(`SELECT * FROM nodes ${whereClause} ORDER BY node_name ASC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as NodeRow[];

  return {
    rows: rows.map(rowToEntry),
    page: safePage,
    pageSize,
    total: totalRow.total,
    totalPages: Math.max(1, Math.ceil(totalRow.total / pageSize)),
  };
}

export async function getNode(nodeId: string): Promise<NodeRegistryEntry | undefined> {
  const row = db.prepare("SELECT * FROM nodes WHERE node_id = ?").get(nodeId) as NodeRow | undefined;
  return row ? rowToEntry(row) : undefined;
}

export async function deleteNode(nodeId: string): Promise<boolean> {
  const result = db.prepare("DELETE FROM nodes WHERE node_id = ?").run(nodeId);
  return result.changes > 0;
}
