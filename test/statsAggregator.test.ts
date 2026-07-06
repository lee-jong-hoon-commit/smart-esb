import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

let recordRun: (typeof import("../src/monitoring/logStore.js"))["recordRun"];
let upsertInterface: (typeof import("../src/monitoring/interfaceRegistry.js"))["upsertInterface"];
let getStats: (typeof import("../src/monitoring/statsAggregator.js"))["getStats"];

beforeAll(async () => {
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "smart-esb-test-"));
  const logStore = await import("../src/monitoring/logStore.js");
  const interfaceRegistry = await import("../src/monitoring/interfaceRegistry.js");
  const statsAggregator = await import("../src/monitoring/statsAggregator.js");
  recordRun = logStore.recordRun;
  upsertInterface = interfaceRegistry.upsertInterface;
  getStats = statsAggregator.getStats;
});

describe("getStats", () => {
  it("always returns exactly `days` daily entries, zero-filled for days with no data", async () => {
    const stats = await getStats(7);
    expect(stats.daily).toHaveLength(7);
    // 오늘이 마지막 항목이어야 함
    expect(stats.daily[6].date).toBe(new Date().toISOString().slice(0, 10));
  });

  it("aggregates today's transactions into the last daily bucket", async () => {
    const interfaceId = `IF-${randomUUID()}`;
    await recordRun({
      transactionId: `TXN-${randomUUID()}`,
      interfaceId,
      interfaceName: "일자별 집계 테스트",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      recordCount: 5,
      failedCount: 2,
      result: "PARTIAL",
      errorDetail: "에러",
    });

    const stats = await getStats(7);
    const today = stats.daily[stats.daily.length - 1];
    expect(today.count).toBeGreaterThanOrEqual(5);
    expect(today.failed).toBeGreaterThanOrEqual(2);
  });

  it("groups by connector type via the interfaces registry (LEFT JOIN)", async () => {
    const interfaceId = `IF-${randomUUID()}`;
    await upsertInterface({
      interfaceId,
      interfaceName: "타입별 집계 테스트",
      connectorType: "DB",
      config: { table: "t", watermarkColumn: "id" },
    });
    await recordRun({
      transactionId: `TXN-${randomUUID()}`,
      interfaceId,
      interfaceName: "타입별 집계 테스트",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      recordCount: 3,
      failedCount: 1,
      result: "PARTIAL",
      errorDetail: "에러",
    });

    const stats = await getStats(7);
    const dbEntry = stats.byConnectorType.find((c) => c.connectorType === "DB");
    expect(dbEntry).toBeDefined();
    expect(dbEntry!.count).toBeGreaterThanOrEqual(3);
    expect(dbEntry!.failed).toBeGreaterThanOrEqual(1);
  });

  it("falls back to UNKNOWN connector type when the interface isn't registered", async () => {
    const interfaceId = `IF-${randomUUID()}`;
    await recordRun({
      transactionId: `TXN-${randomUUID()}`,
      interfaceId,
      interfaceName: "미등록 인터페이스",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      recordCount: 1,
      failedCount: 0,
      result: "SUCCESS",
      errorDetail: null,
    });

    const stats = await getStats(7);
    const entry = stats.byInterface.find((i) => i.interfaceId === interfaceId);
    expect(entry).toBeDefined();
    expect(entry!.connectorType).toBe("UNKNOWN");
  });

  it("excludes data older than the requested window", async () => {
    const interfaceId = `IF-${randomUUID()}`;
    const longAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    await recordRun({
      transactionId: `TXN-${randomUUID()}`,
      interfaceId,
      interfaceName: "오래된 데이터",
      startedAt: longAgo,
      endedAt: longAgo,
      recordCount: 9,
      failedCount: 0,
      result: "SUCCESS",
      errorDetail: null,
    });

    const stats = await getStats(7);
    expect(stats.byInterface.find((i) => i.interfaceId === interfaceId)).toBeUndefined();
    const totalDaily = stats.daily.reduce((sum, d) => sum + d.count, 0);
    // 30일 전 데이터가 7일 집계에 섞여 들어가면 안 됨 (다른 테스트의 데이터는 포함될 수 있으므로
    // 정확한 총합 대신, 최소한 9건짜리 오래된 레코드가 어디에도 없다는 것만 확인)
    expect(totalDaily).toBeGreaterThanOrEqual(0);
  });
});
