import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { QueueConnectorStats } from "../src/monitoring/connectorTypes.js";

let recordRun: (typeof import("../src/monitoring/logStore.js"))["recordRun"];
let upsertInterface: (typeof import("../src/monitoring/interfaceRegistry.js"))["upsertInterface"];
let getConnectorStats: (typeof import("../src/monitoring/connectorStats.js"))["getConnectorStats"];

beforeAll(async () => {
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "smart-esb-test-"));
  const logStore = await import("../src/monitoring/logStore.js");
  const interfaceRegistry = await import("../src/monitoring/interfaceRegistry.js");
  const connectorStats = await import("../src/monitoring/connectorStats.js");
  recordRun = logStore.recordRun;
  upsertInterface = interfaceRegistry.upsertInterface;
  getConnectorStats = connectorStats.getConnectorStats;
});

describe("getConnectorStats", () => {
  it("aggregates today's calls/success/fail/avg duration per connector type", async () => {
    const interfaceId = `IF-${randomUUID()}`;
    await upsertInterface({
      interfaceId,
      interfaceName: "테스트 HTTP 연계",
      connectorType: "HTTP",
      config: { url: "http://example.com/api", method: "POST", serviceIp: "10.0.0.5" },
    });

    const now = new Date();
    await recordRun({
      transactionId: `TXN-${randomUUID()}`,
      interfaceId,
      interfaceName: "테스트 HTTP 연계",
      startedAt: now.toISOString(),
      endedAt: new Date(now.getTime() + 100).toISOString(),
      recordCount: 4,
      failedCount: 1,
      result: "PARTIAL",
      errorDetail: "에러",
    });
    await recordRun({
      transactionId: `TXN-${randomUUID()}`,
      interfaceId,
      interfaceName: "테스트 HTTP 연계",
      startedAt: now.toISOString(),
      endedAt: new Date(now.getTime() + 300).toISOString(),
      recordCount: 2,
      failedCount: 0,
      result: "SUCCESS",
      errorDetail: null,
    });

    const stats = await getConnectorStats();
    const entry = stats.find((s) => s.interfaceId === interfaceId);
    expect(entry).toBeDefined();
    expect(entry!.connectorType).toBe("HTTP");
    expect(entry!.todayCount).toBe(6);
    expect(entry!.todaySuccess).toBe(5);
    expect(entry!.todayFailed).toBe(1);
    expect(entry!.avgDurationMs).toBe(200);
    if (entry!.connectorType === "HTTP") {
      expect(entry!.serviceIp).toBe("10.0.0.5");
    }
  });

  it("marks a QUEUE connector as 지연 when it has a backlog, 정상 otherwise", async () => {
    const stuckId = `IF-${randomUUID()}`;
    const flowingId = `IF-${randomUUID()}`;
    await upsertInterface({
      interfaceId: stuckId,
      interfaceName: "적체된 큐",
      connectorType: "QUEUE",
      config: { source: "A", destination: "B", queueName: "q1" },
    });
    await upsertInterface({
      interfaceId: flowingId,
      interfaceName: "정상 큐",
      connectorType: "QUEUE",
      config: { source: "A", destination: "B", queueName: "q2" },
    });

    const now = new Date().toISOString();
    await recordRun({
      transactionId: `TXN-${randomUUID()}`,
      interfaceId: stuckId,
      interfaceName: "적체된 큐",
      startedAt: now,
      endedAt: now,
      recordCount: 3,
      failedCount: 2,
      result: "PARTIAL",
      errorDetail: "에러",
    });
    await recordRun({
      transactionId: `TXN-${randomUUID()}`,
      interfaceId: flowingId,
      interfaceName: "정상 큐",
      startedAt: now,
      endedAt: now,
      recordCount: 3,
      failedCount: 0,
      result: "SUCCESS",
      errorDetail: null,
    });

    const stats = await getConnectorStats();
    const stuck = stats.find((s) => s.interfaceId === stuckId) as QueueConnectorStats;
    const flowing = stats.find((s) => s.interfaceId === flowingId) as QueueConnectorStats;
    expect(stuck.status).toBe("지연");
    expect(stuck.backlogCount).toBe(2);
    expect(flowing.status).toBe("정상");
    expect(flowing.backlogCount).toBe(0);
  });
});
