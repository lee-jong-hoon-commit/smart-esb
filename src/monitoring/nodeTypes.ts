export type NodeType = "ESB" | "AGENT" | "ADAPTER";

export interface EsbNodeConfig {
  port: number;
  version: string;
}

export interface AgentNodeConfig {
  targetSystem: string;
  version: string;
}

export interface AdapterNodeConfig {
  adapterKind: string; // 예: DB_ADAPTER, FILE_ADAPTER, QUEUE_ADAPTER
  version: string;
}

export type NodeConfig = EsbNodeConfig | AgentNodeConfig | AdapterNodeConfig;

export interface NodeRegistryEntry {
  nodeId: string;
  nodeName: string;
  nodeType: NodeType;
  host: string;
  config: NodeConfig;
  createdAt: string;
}

export interface NodeRegistryPage {
  rows: NodeRegistryEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type NodeStatus = "정상" | "경고" | "장애" | "알수없음";

export interface NodeHeartbeat {
  nodeId: string;
  reportedAt: string;
  status: NodeStatus;
  cpuPct: number;
  memPct: number;
  diskPct: number;
  uptimeSec: number;
}

export interface NodeStatusEntry extends NodeRegistryEntry {
  status: NodeStatus;
  cpuPct: number | null;
  memPct: number | null;
  diskPct: number | null;
  uptimeSec: number | null;
  lastHeartbeatAt: string | null;
}

export interface NodeStatusPage {
  rows: NodeStatusEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
