import { db } from "../db/index.js";
import type { ResourceConfig, ResourceRegistryEntry, ResourceRegistryPage, ResourceType } from "./resourceTypes.js";

interface ResourceRow {
  resource_id: string;
  resource_name: string;
  resource_type: string;
  config_json: string;
  created_at: string;
}

function rowToEntry(row: ResourceRow): ResourceRegistryEntry {
  return {
    resourceId: row.resource_id,
    resourceName: row.resource_name,
    resourceType: row.resource_type as ResourceType,
    config: JSON.parse(row.config_json),
    createdAt: row.created_at,
  };
}

export interface UpsertResourceInput {
  resourceId: string;
  resourceName: string;
  resourceType: ResourceType;
  config: ResourceConfig;
}

export async function upsertResource(input: UpsertResourceInput): Promise<void> {
  db.prepare(
    `INSERT INTO shared_resources (resource_id, resource_name, resource_type, config_json, created_at)
     VALUES (@resourceId, @resourceName, @resourceType, @configJson, @createdAt)
     ON CONFLICT(resource_id) DO UPDATE SET
       resource_name = excluded.resource_name,
       resource_type = excluded.resource_type,
       config_json = excluded.config_json`,
  ).run({
    resourceId: input.resourceId,
    resourceName: input.resourceName,
    resourceType: input.resourceType,
    configJson: JSON.stringify(input.config),
    createdAt: new Date().toISOString(),
  });
}

// 리소스가 많아질 수 있다는 전제로, 타입 필터(선택) + 이름 검색(LIKE) + 페이지네이션(LIMIT/OFFSET)을
// SQL 단에서 적용합니다. resourceType을 생략하면 모든 타입을 대상으로 검색합니다.
export async function listResourcesPage(
  resourceType: ResourceType | undefined,
  page = 1,
  pageSize = 20,
  search?: string,
): Promise<ResourceRegistryPage> {
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * pageSize;
  const searchFilter = search?.trim() ? `%${search.trim()}%` : null;

  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (resourceType) {
    conditions.push("resource_type = ?");
    params.push(resourceType);
  }
  if (searchFilter) {
    conditions.push("(resource_name LIKE ? OR resource_id LIKE ?)");
    params.push(searchFilter, searchFilter);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const totalRow = db.prepare(`SELECT COUNT(*) as total FROM shared_resources ${whereClause}`).get(...params) as {
    total: number;
  };
  const rows = db
    .prepare(`SELECT * FROM shared_resources ${whereClause} ORDER BY resource_name ASC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as ResourceRow[];

  return {
    rows: rows.map(rowToEntry),
    page: safePage,
    pageSize,
    total: totalRow.total,
    totalPages: Math.max(1, Math.ceil(totalRow.total / pageSize)),
  };
}

export async function getResource(resourceId: string): Promise<ResourceRegistryEntry | undefined> {
  const row = db.prepare("SELECT * FROM shared_resources WHERE resource_id = ?").get(resourceId) as
    | ResourceRow
    | undefined;
  return row ? rowToEntry(row) : undefined;
}

export async function deleteResource(resourceId: string): Promise<boolean> {
  const result = db.prepare("DELETE FROM shared_resources WHERE resource_id = ?").run(resourceId);
  return result.changes > 0;
}
