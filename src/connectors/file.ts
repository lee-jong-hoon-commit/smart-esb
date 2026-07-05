import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Message } from "../core/types.js";
import type { DestinationConnector, SourceConnector } from "./types.js";

export function createFileSource(filePath: string): SourceConnector {
  return {
    async receive(): Promise<Message[]> {
      let raw: string;
      try {
        raw = await fs.readFile(filePath, "utf-8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw err;
      }
      const parsed = raw.trim() ? JSON.parse(raw) : [];
      const records = Array.isArray(parsed) ? parsed : [parsed];
      return records.map((payload) => ({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        payload,
      }));
    },
  };
}

export function createFileDestination(filePath: string): DestinationConnector {
  return {
    async send(message: Message): Promise<void> {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const line = JSON.stringify(message.payload) + "\n";
      await fs.appendFile(filePath, line, "utf-8");
    },
  };
}
