import { randomUUID } from "node:crypto";
import type { Message } from "../core/types.js";
import type { DestinationConnector, SourceConnector } from "./types.js";

export function createHttpSource(url: string): SourceConnector {
  return {
    async receive(): Promise<Message[]> {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP 소스 조회 실패: ${res.status} ${res.statusText}`);
      const parsed = await res.json();
      const records = Array.isArray(parsed) ? parsed : [parsed];
      return records.map((payload) => ({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        payload,
      }));
    },
  };
}

export function createHttpDestination(url: string, method: "GET" | "POST" | "PUT" | "PATCH"): DestinationConnector {
  return {
    async send(message: Message): Promise<void> {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "GET" ? undefined : JSON.stringify(message.payload),
      });
      if (!res.ok) throw new Error(`HTTP 목적지 전송 실패: ${res.status} ${res.statusText}`);
    },
  };
}
