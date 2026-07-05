import type { Message } from "../core/types.js";
import type { DestinationConnector, SourceConnector } from "./types.js";

const queues = new Map<string, Message[]>();

export function createMemorySource(queue: string): SourceConnector {
  return {
    async receive(): Promise<Message[]> {
      const pending = queues.get(queue) ?? [];
      queues.set(queue, []);
      return pending;
    },
  };
}

export function createMemoryDestination(queue: string): DestinationConnector {
  return {
    async send(message: Message): Promise<void> {
      const existing = queues.get(queue) ?? [];
      existing.push(message);
      queues.set(queue, existing);
    },
  };
}
