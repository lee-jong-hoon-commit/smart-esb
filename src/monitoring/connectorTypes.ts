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
  timeoutMs?: number; // 이 값을 넘는 트랜잭션은 "느린 호출"로 집계
}

export interface DbConfig {
  table: string;
  watermarkColumn: string;
  pollIntervalSec?: number; // 정상적으로 도는 경우의 예상 폴링 주기 (지연 여부 판단용)
}

export interface FileConfig {
  path: string;
  pollIntervalSec?: number;
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
  failureRatePct: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  lastRunAt: string | null;
  recentErrors: string[];
}

export type ScheduleStatus = "정상" | "지연" | "알수없음";

export interface QueueConnectorStats extends ConnectorStatsBase, QueueConfig {
  connectorType: "QUEUE";
  backlogCount: number;
  oldestBacklogAgeSec: number | null;
  status: "정상" | "지연";
}

export interface HttpConnectorStats extends ConnectorStatsBase, HttpConfig {
  connectorType: "HTTP";
  timeoutMs: number;
  slowRunRatePct: number;
}

export interface DbConnectorStats extends ConnectorStatsBase, DbConfig {
  connectorType: "DB";
  scheduleStatus: ScheduleStatus;
}

export interface FileConnectorStats extends ConnectorStatsBase, FileConfig {
  connectorType: "FILE";
  scheduleStatus: ScheduleStatus;
}

export type ConnectorStats = QueueConnectorStats | HttpConnectorStats | DbConnectorStats | FileConnectorStats;

export interface ConnectorStatsPage {
  rows: ConnectorStats[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
