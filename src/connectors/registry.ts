import type { ConnectorConfig } from "../core/types.js";
import { createDbDestination, createDbSource } from "./db.js";
import { createFileDestination, createFileSource } from "./file.js";
import { createHttpDestination, createHttpSource } from "./http.js";
import { createMemoryDestination, createMemorySource } from "./memory.js";
import type { DestinationConnector, SourceConnector } from "./types.js";

export function createSource(flowId: string, config: ConnectorConfig): SourceConnector {
  switch (config.type) {
    case "file":
      return createFileSource(config.path);
    case "memory":
      return createMemorySource(config.queue);
    case "http":
      return createHttpSource(config.url);
    case "db":
      if (!config.watermarkColumn) {
        throw new Error("db 소스는 watermarkColumn이 필요합니다.");
      }
      return createDbSource(flowId, config.table, config.watermarkColumn, config.filter);
  }
}

export function createDestination(config: ConnectorConfig): DestinationConnector {
  switch (config.type) {
    case "file":
      return createFileDestination(config.path);
    case "memory":
      return createMemoryDestination(config.queue);
    case "http":
      return createHttpDestination(config.url, config.method);
    case "db":
      return createDbDestination(config.table);
  }
}
