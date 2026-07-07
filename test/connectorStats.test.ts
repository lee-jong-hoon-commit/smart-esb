import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { DbConnectorStats, HttpConnectorStats, QueueConnectorStats } from "../src/monitoring/connectorTypes.js";

let recordRun: (typeof import("../src/monitoring/logStore.js"))["recordRun"];
let upsertInterface: (typeof import("../src/monitoring/interfaceRegistry.js"))["upsertInterface"];
let getConnectorStatsPage: (typeof import("../src/monitoring/connectorStats.js"))["getConnectorStatsPage"];

beforeAll(async () => {
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "smart-esb-test-"));
  const logStore = await import("../src/monitoring/logStore.js");
  const interfaceRegistry = await import("../src/monitoring/interfaceRegistry.js");
  const connectorStats = await import("../src/monitoring/connectorStats.js");
  recordRun = logStore.recordRun;
  upsertInterface = interfaceRegistry.upsertInterface;
  getConnectorStatsPage = connectorStats.getConnectorStatsPage;
});

describe("getConnectorStatsPage", () => {
  it("aggregates today's calls/success/fail/duration + failure rate + recent errors for HTTP", async () => {
    const interfaceId = `IF-${randomUUID()}`;
    const interfaceName = `테스트 HTTP 연계 ${randomUUID()}`;
    await upsertInterface({
      interfaceId,
      interfaceName,
      connectorType: "HTTP",
      config: { url: "http://example.com/api", method: "POST", serviceIp: "10.0.0.5", timeoutMs: 150 },
    });

    const now = new Date();
    await recordRun({
      transactionId: `TXN-${randomUUID()}`,
      interfaceId,
      interfaceName,
      startedAt: now.toISOString(),
      endedAt: new Date(now.getTime() + 100).toISOString(),
      recordCount: 4,
      failedCount: 1,
      result: "PARTIAL",
      errorDetail: "에러 A",
    });
    await recordRun({
      transactionId: `TXN-${randomUUID()}`,
      interfaceId,
      interfaceName,
      startedAt: now.toISOString(),
      endedAt: new Date(now.getTime() + 300).toISOString(),
      recordCount: 2,
      failedCount: 0,
      result: "SUCCESS",
      errorDetail: null,
    });

    const page = await getConnectorStatsPage("HTTP", 1, 20, interfaceName);
    const entry = page.rows.find((s) => s.interfaceId === interfaceId) as HttpConnectorStats;
    expect(entry).toBeDefined();
    expect(entry.todayCount).toBe(6);
    expect(entry.todaySuccess).toBe(5);
    expect(entry.todayFailed).toBe(1);
    expect(entry.failureRatePct).toBeCloseTo((1 / 6) * 100, 1);
    expect(entry.avgDurationMs).toBe(200);
    expect(entry.minDurationMs).toBe(100);
    expect(entry.maxDurationMs).toBe(300);
    expect(entry.recentErrors).toEqual(["에러 A"]);
    expect(entry.serviceIp).toBe("10.0.0.5");
    // durationMs 100/300 vs timeoutMs 150 -> only the 300ms run is "slow" => 1/2 = 50%
    expect(entry.slowRunRatePct).toBe(50);
  });

  it("marks a QUEUE connector as 지연 with backlog age when it has a backlog, 정상 otherwise", async () => {
    const stuckId = `IF-${randomUUID()}`;
    const flowingId = `IF-${randomUUID()}`;
    const stuckName = `적체된 큐 ${randomUUID()}`;
    const flowingName = `정상 큐 ${randomUUID()}`;
    await upsertInterface({
      interfaceId: stuckId,
      interfaceName: stuckName,
      connectorType: "QUEUE",
      config: { source: "A", destination: "B", queueName: "q1" },
    });
    await upsertInterface({
      interfaceId: flowingId,
      interfaceName: flowingName,
      connectorType: "QUEUE",
      config: { source: "A", destination: "B", queueName: "q2" },
    });

    const now = new Date().toISOString();
    await recordRun({
      transactionId: `TXN-${randomUUID()}`,
      interfaceId: stuckId,
      interfaceName: stuckName,
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
      interfaceName: flowingName,
      startedAt: now,
      endedAt: now,
      recordCount: 3,
      failedCount: 0,
      result: "SUCCESS",
      errorDetail: null,
    });

    const stuckPage = await getConnectorStatsPage("QUEUE", 1, 20, stuckName);
    const flowingPage = await getConnectorStatsPage("QUEUE", 1, 20, flowingName);
    const stuck = stuckPage.rows[0] as QueueConnectorStats;
    const flowing = flowingPage.rows[0] as QueueConnectorStats;
    expect(stuck.status).toBe("지연");
    expect(stuck.backlogCount).toBe(2);
    expect(stuck.oldestBacklogAgeSec).not.toBeNull();
    expect(flowing.status).toBe("정상");
    expect(flowing.backlogCount).toBe(0);
    expect(flowing.oldestBacklogAgeSec).toBeNull();
  });

  it("computes DB schedule status from pollIntervalSec vs lastRunAt", async () => {
    const onTimeId = `IF-${randomUUID()}`;
    const lateId = `IF-${randomUUID()}`;
    const onTimeName = `정상 DB ${randomUUID()}`;
    const lateName = `지연 DB ${randomUUID()}`;
    await upsertInterface({
      interfaceId: onTimeId,
      interfaceName: onTimeName,
      connectorType: "DB",
      config: { table: "t", watermarkColumn: "id", pollIntervalSec: 300 },
    });
    await upsertInterface({
      interfaceId: lateId,
      interfaceName: lateName,
      connectorType: "DB",
      config: { table: "t", watermarkColumn: "id", pollIntervalSec: 300 },
    });

    await recordRun({
      transactionId: `TXN-${randomUUID()}`,
      interfaceId: onTimeId,
      interfaceName: onTimeName,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      recordCount: 1,
      failedCount: 0,
      result: "SUCCESS",
      errorDetail: null,
    });
    await recordRun({
      transactionId: `TXN-${randomUUID()}`,
      interfaceId: lateId,
      interfaceName: lateName,
      startedAt: new Date(Date.now() - 3600_000).toISOString(),
      endedAt: new Date(Date.now() - 3600_000).toISOString(),
      recordCount: 1,
      failedCount: 0,
      result: "SUCCESS",
      errorDetail: null,
    });

    const onTimePage = await getConnectorStatsPage("DB", 1, 20, onTimeName);
    const latePage = await getConnectorStatsPage("DB", 1, 20, lateName);
    expect((onTimePage.rows[0] as DbConnectorStats).scheduleStatus).toBe("정상");
    expect((latePage.rows[0] as DbConnectorStats).scheduleStatus).toBe("지연");
  });

  it("paginates and filters by search within a connector type", async () => {
    for (let i = 0; i < 15; i++) {
      await upsertInterface({
        interfaceId: `IF-file-${randomUUID()}`,
        interfaceName: `파일 커넥터 페이지 테스트 ${i}`,
        connectorType: "FILE",
        config: { path: `/data/${i}.json` },
      });
    }
    const page1 = await getConnectorStatsPage("FILE", 1, 10);
    expect(page1.rows).toHaveLength(10);
    expect(page1.total).toBeGreaterThanOrEqual(15);
    expect(page1.totalPages).toBeGreaterThanOrEqual(2);

    const searched = await getConnectorStatsPage("FILE", 1, 20, "페이지 테스트 7");
    expect(searched.rows.some((r) => r.interfaceName.includes("페이지 테스트 7"))).toBe(true);
  });

  it("searches across all connector types when connectorType is omitted", async () => {
    const marker = randomUUID();
    const httpId = `IF-http-${randomUUID()}`;
    const queueId = `IF-queue-${randomUUID()}`;
    await upsertInterface({
      interfaceId: httpId,
      interfaceName: `전체검색 HTTP ${marker}`,
      connectorType: "HTTP",
      config: { url: "http://example.com", method: "GET", serviceIp: "10.0.0.1" },
    });
    await upsertInterface({
      interfaceId: queueId,
      interfaceName: `전체검색 QUEUE ${marker}`,
      connectorType: "QUEUE",
      config: { source: "A", destination: "B", queueName: "q" },
    });

    const page = await getConnectorStatsPage(undefined, 1, 20, marker);
    const foundTypes = page.rows.map((r) => r.connectorType).sort();
    expect(foundTypes).toEqual(["HTTP", "QUEUE"]);
  });
});
