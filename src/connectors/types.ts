import type { ConnectorConfig, Message } from "../core/types.js";

export interface SourceConnector {
  receive(): Promise<Message[]>;
}

export interface DestinationConnector {
  send(message: Message): Promise<void>;
}

export type CreateSource = (config: ConnectorConfig) => SourceConnector;
export type CreateDestination = (config: ConnectorConfig) => DestinationConnector;
