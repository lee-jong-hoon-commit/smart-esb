export type ResourceType = "DB" | "JMS";

export interface DbResourceConfig {
  host: string;
  port: number;
  database: string;
  driver: string; // 예: oracle, mysql, postgresql, mssql
  username: string;
}

export interface JmsResourceConfig {
  brokerUrl: string;
  connectionFactory: string;
  username: string;
}

export type ResourceConfig = DbResourceConfig | JmsResourceConfig;

export interface ResourceRegistryEntry {
  resourceId: string;
  resourceName: string;
  resourceType: ResourceType;
  config: ResourceConfig;
  createdAt: string;
}

export interface ResourceRegistryPage {
  rows: ResourceRegistryEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
