import type { Message } from "../core/types.js";

export interface SourceConnector {
  receive(): Promise<Message[]>;
}

export interface DestinationConnector {
  send(message: Message): Promise<void>;
}
