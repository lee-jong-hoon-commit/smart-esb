import type { ConnectorConfig } from "../core/types.js";
import { createFileDestination, createFileSource } from "./file.js";
import { createHttpDestination, createHttpSource } from "./http.js";
import { createMemoryDestination, createMemorySource } from "./memory.js";
import type { DestinationConnector, SourceConnector } from "./types.js";

export function createSource(config: ConnectorConfig): SourceConnector {
  switch (config.type) {
    case "file":
      return createFileSource(config.path);
    case "memory":
      return createMemorySource(config.queue);
    case "http":
      return createHttpSource(config.url);
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
  }
}
