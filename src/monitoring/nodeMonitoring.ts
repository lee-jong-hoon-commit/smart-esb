import { db } from "../db/index.js";
import { listNodesPage } from "./nodeRegistry.js";
import type { NodeHeartbeat, NodeStatus, NodeStatusEntry, NodeStatusPage, NodeType } from "./nodeTypes.js";

interface HeartbeatRow {
  node_id: string;
  reported_at: string;
  status: string;
  cpu_pct: number;
  mem_pct: number;
  disk_pct: number;
  uptime_sec: number;
}

function rowToHeartbeat(row: HeartbeatRow): NodeHeartbeat {
  return {
    nodeId: row.node_id,
    reportedAt: row.reported_at,
    status: row.status as NodeStatus,
    cpuPct: row.cpu_pct,
    memPct: row.mem_pct,
    diskPct: row.disk_pct,
    uptimeSec: row.uptime_sec,
  };
}

export async function recordHeartbeat(input: NodeHeartbeat): Promise<void> {
  db.prepare(
    `INSERT INTO node_heartbeats (node_id, reported_at, status, cpu_pct, mem_pct, disk_pct, uptime_sec)
     VALUES (@nodeId, @reportedAt, @status, @cpuPct, @memPct, @diskPct, @uptimeSec)`,
  ).run(input);
}

function latestHeartbeat(nodeId: string): NodeHeartbeat | null {
  const row = db
    .prepare("SELECT * FROM node_heartbeats WHERE node_id = ? ORDER BY reported_at DESC LIMIT 1")
    .get(nodeId) as HeartbeatRow | undefined;
  return row ? rowToHeartbeat(row) : null;
}

// 노드 등록 정보 + 최신 하트비트(상태/자원 사용률)를 합쳐서 보여줍니다. 하트비트가 아직
// 한 번도 없으면 상태는 "알수없음"으로 표시합니다.
export async function getNodeStatusPage(
  nodeType: NodeType | undefined,
  page = 1,
  pageSize = 20,
  search?: string,
): Promise<NodeStatusPage> {
  const regPage = await listNodesPage(nodeType, page, pageSize, search);
  const rows: NodeStatusEntry[] = regPage.rows.map((entry) => {
    const hb = latestHeartbeat(entry.nodeId);
    return {
      ...entry,
      status: hb?.status ?? "알수없음",
      cpuPct: hb?.cpuPct ?? null,
      memPct: hb?.memPct ?? null,
      diskPct: hb?.diskPct ?? null,
      uptimeSec: hb?.uptimeSec ?? null,
      lastHeartbeatAt: hb?.reportedAt ?? null,
    };
  });
  return { rows, page: regPage.page, pageSize: regPage.pageSize, total: regPage.total, totalPages: regPage.totalPages };
}

export interface NodeOverview {
  totalNodes: number;
  byType: { nodeType: NodeType; count: number }[];
  byStatus: { status: NodeStatus; count: number }[];
}

// 대시보드용 요약: 전체 노드 수, 타입별 개수, 최신 하트비트 기준 상태별 개수.
// 노드 수가 늘어나도 등록된 노드 전체를 한 번만 훑으면 되므로(수백~수천 규모까지는)
// 별도 페이지네이션 없이 집계합니다.
export async function getNodeOverview(): Promise<NodeOverview> {
  const nodes = db.prepare("SELECT node_id, node_type FROM nodes").all() as { node_id: string; node_type: string }[];

  const byTypeMap = new Map<string, number>();
  const byStatusMap = new Map<string, number>();
  for (const node of nodes) {
    byTypeMap.set(node.node_type, (byTypeMap.get(node.node_type) ?? 0) + 1);
    const hb = latestHeartbeat(node.node_id);
    const status = hb?.status ?? "알수없음";
    byStatusMap.set(status, (byStatusMap.get(status) ?? 0) + 1);
  }

  return {
    totalNodes: nodes.length,
    byType: [...byTypeMap.entries()].map(([nodeType, count]) => ({ nodeType: nodeType as NodeType, count })),
    byStatus: [...byStatusMap.entries()].map(([status, count]) => ({ status: status as NodeStatus, count })),
  };
}

export interface ResourceUsageRow {
  nodeId: string;
  nodeName: string;
  nodeType: NodeType;
  status: NodeStatus;
  cpuPct: number | null;
  memPct: number | null;
  diskPct: number | null;
  lastHeartbeatAt: string | null;
}

// 대시보드의 자원 사용률 목록: 노드별 최신 CPU/메모리/디스크 사용률의 스냅샷입니다.
export async function getResourceUsageSnapshot(): Promise<ResourceUsageRow[]> {
  const nodes = db.prepare("SELECT * FROM nodes ORDER BY node_name ASC").all() as {
    node_id: string;
    node_name: string;
    node_type: string;
  }[];

  return nodes.map((node) => {
    const hb = latestHeartbeat(node.node_id);
    return {
      nodeId: node.node_id,
      nodeName: node.node_name,
      nodeType: node.node_type as NodeType,
      status: hb?.status ?? "알수없음",
      cpuPct: hb?.cpuPct ?? null,
      memPct: hb?.memPct ?? null,
      diskPct: hb?.diskPct ?? null,
      lastHeartbeatAt: hb?.reportedAt ?? null,
    };
  });
}
