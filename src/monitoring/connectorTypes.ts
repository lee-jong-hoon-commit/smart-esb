export type ConnectorType = "QUEUE" | "HTTP" | "DB" | "FILE";

export interface QueueConfig {
  source: string;
  destination: string;
  queueName: string;
}

export interface HttpConfig {
  url: string;
  method: string;
  serviceIp: string;
}

export interface DbConfig {
  table: string;
  watermarkColumn: string;
}

export interface FileConfig {
  path: string;
}

export type ConnectorConfig = QueueConfig | HttpConfig | DbConfig | FileConfig;

export interface InterfaceRegistryEntry {
  interfaceId: string;
  interfaceName: string;
  connectorType: ConnectorType;
  config: ConnectorConfig;
  createdAt: string;
}

interface ConnectorStatsBase {
  interfaceId: string;
  interfaceName: string;
  todayCount: number;
  todaySuccess: number;
  todayFailed: number;
  avgDurationMs: number;
  lastRunAt: string | null;
}

export interface QueueConnectorStats extends ConnectorStatsBase, QueueConfig {
  connectorType: "QUEUE";
  backlogCount: number;
  status: "정상" | "지연";
}

export interface HttpConnectorStats extends ConnectorStatsBase, HttpConfig {
  connectorType: "HTTP";
}

export interface DbConnectorStats extends ConnectorStatsBase, DbConfig {
  connectorType: "DB";
}

export interface FileConnectorStats extends ConnectorStatsBase, FileConfig {
  connectorType: "FILE";
}

export type ConnectorStats = QueueConnectorStats | HttpConnectorStats | DbConnectorStats | FileConnectorStats;
