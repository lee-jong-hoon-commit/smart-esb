import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

let recordRun: (typeof import("../src/monitoring/logStore.js"))["recordRun"];
let upsertInterface: (typeof import("../src/monitoring/interfaceRegistry.js"))["upsertInterface"];
let getDailyStats: (typeof import("../src/monitoring/statsAggregator.js"))["getDailyStats"];
let getConnectorTypeStats: (typeof import("../src/monitoring/statsAggregator.js"))["getConnectorTypeStats"];
let getInterfaceStatsPage: (typeof import("../src/monitoring/statsAggregator.js"))["getInterfaceStatsPage"];

beforeAll(async () => {
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "smart-esb-test-"));
  const logStore = await import("../src/monitoring/logStore.js");
  const interfaceRegistry = await import("../src/monitoring/interfaceRegistry.js");
  const statsAggregator = await import("../src/monitoring/statsAggregator.js");
  recordRun = logStore.recordRun;
  upsertInterface = interfaceRegistry.upsertInterface;
  getDailyStats = statsAggregator.getDailyStats;
  getConnectorTypeStats = statsAggregator.getConnectorTypeStats;
  getInterfaceStatsPage = statsAggregator.getInterfaceStatsPage;
});

describe("getDailyStats", () => {
  it("returns day-bucketed series (zero-filled) when days <= 31", async () => {
    const stats = await getDailyStats(7);
    expect(stats.bucket).toBe("day");
    expect(stats.series).toHaveLength(7);
    expect(stats.series[6].date).toBe(new Date().toISOString().slice(0, 10));
  });

  it("aggregates today's transactions into the last daily bucket", async () => {
    await recordRun({
      transactionId: `TXN-${randomUUID()}`,
      interfaceId: `IF-${randomUUID()}`,
      interfaceName: "일자별 집계 테스트",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      recordCount: 5,
      failedCount: 2,
      result: "PARTIAL",
      errorDetail: "에러",
    });
    const stats = await getDailyStats(7);
    const today = stats.series[stats.series.length - 1];
    expect(today.count).toBeGreaterThanOrEqual(5);
    expect(today.failed).toBeGreaterThanOrEqual(2);
  });

  it("switches to week-bucketed series once the range exceeds 31 days, capping the bucket count", async () => {
    const stats = await getDailyStats(90);
    expect(stats.bucket).toBe("week");
    // 90일 / 7 = 13개 버킷 정도여야 하고, 절대 90개(일 단위)가 되면 안 됨
    expect(stats.series.length).toBeLessThanOrEqual(13);
    expect(stats.series.length).toBeGreaterThan(0);
  });
});

describe("getConnectorTypeStats", () => {
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

    const stats = await getConnectorTypeStats(7);
    const dbEntry = stats.find((c) => c.connectorType === "DB");
    expect(dbEntry).toBeDefined();
    expect(dbEntry!.count).toBeGreaterThanOrEqual(3);
    expect(dbEntry!.failed).toBeGreaterThanOrEqual(1);
  });
});

describe("getInterfaceStatsPage", () => {
  it("paginates at the SQL level so a large interface count doesn't return everything at once", async () => {
    for (let i = 0; i < 25; i++) {
      const interfaceId = `IF-page-${randomUUID()}`;
      await recordRun({
        transactionId: `TXN-${randomUUID()}`,
        interfaceId,
        interfaceName: `페이지네이션 테스트 ${i}`,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        recordCount: 1,
        failedCount: 0,
        result: "SUCCESS",
        errorDetail: null,
      });
    }

    const page1 = await getInterfaceStatsPage(7, 1, 10);
    expect(page1.rows).toHaveLength(10);
    expect(page1.total).toBeGreaterThanOrEqual(25);
    expect(page1.totalPages).toBeGreaterThanOrEqual(3);
  });

  it("falls back to UNKNOWN connector type when the interface isn't registered", async () => {
    const interfaceId = `IF-${randomUUID()}`;
    await recordRun({
      transactionId: `TXN-${randomUUID()}`,
      interfaceId,
      interfaceName: "미등록 인터페이스 검색용",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      recordCount: 1,
      failedCount: 0,
      result: "SUCCESS",
      errorDetail: null,
    });

    const result = await getInterfaceStatsPage(7, 1, 20, "미등록 인터페이스 검색용");
    expect(result.total).toBe(1);
    expect(result.rows[0].interfaceId).toBe(interfaceId);
    expect(result.rows[0].connectorType).toBe("UNKNOWN");
  });

  it("filters by search term", async () => {
    const uniqueName = `검색전용-${randomUUID()}`;
    await recordRun({
      transactionId: `TXN-${randomUUID()}`,
      interfaceId: `IF-${randomUUID()}`,
      interfaceName: uniqueName,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      recordCount: 1,
      failedCount: 0,
      result: "SUCCESS",
      errorDetail: null,
    });

    const result = await getInterfaceStatsPage(7, 1, 20, uniqueName.slice(0, 6));
    expect(result.total).toBe(1);
    expect(result.rows[0].interfaceName).toBe(uniqueName);
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

    const result = await getInterfaceStatsPage(7, 1, 100, "오래된 데이터");
    expect(result.total).toBe(0);
  });
});
