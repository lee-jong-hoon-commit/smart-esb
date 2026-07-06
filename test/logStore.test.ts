import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

let recordRun: (typeof import("../src/monitoring/logStore.js"))["recordRun"];
let getRecentRuns: (typeof import("../src/monitoring/logStore.js"))["getRecentRuns"];
let getRunDetail: (typeof import("../src/monitoring/logStore.js"))["getRunDetail"];
let getRunsPage: (typeof import("../src/monitoring/logStore.js"))["getRunsPage"];
let resendRecord: (typeof import("../src/monitoring/logStore.js"))["resendRecord"];
let summarizeRange: (typeof import("../src/monitoring/logStore.js"))["summarizeRange"];

// env vars must be set before db/index.js (via config.js) is first imported, since it reads
// process.env once at module load and stays cached for the process.
beforeAll(async () => {
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "smart-esb-test-"));
  const logStore = await import("../src/monitoring/logStore.js");
  recordRun = logStore.recordRun;
  getRecentRuns = logStore.getRecentRuns;
  getRunDetail = logStore.getRunDetail;
  getRunsPage = logStore.getRunsPage;
  resendRecord = logStore.resendRecord;
  summarizeRange = logStore.summarizeRange;
});

describe("logStore", () => {
  it("records a transaction and retrieves it in the interface's recent runs", async () => {
    const interfaceId = `IF-${randomUUID()}`;
    const transactionId = `TXN-${randomUUID()}`;
    await recordRun({
      transactionId,
      interfaceId,
      interfaceName: "테스트 연계",
      startedAt: "2026-07-05T00:00:00.000Z",
      endedAt: "2026-07-05T00:00:00.500Z",
      recordCount: 3,
      failedCount: 1,
      result: "PARTIAL",
      errorDetail: "목적지 전송 실패: 500",
    });
    const runs = await getRecentRuns(10, interfaceId);
    expect(runs).toHaveLength(1);
    expect(runs[0].transactionId).toBe(transactionId);
    expect(runs[0].durationMs).toBe(500);
    expect(runs[0].result).toBe("PARTIAL");
  });

  it("returns full record detail (payloads + per-record status) for a transaction", async () => {
    const transactionId = `TXN-${randomUUID()}`;
    await recordRun({
      transactionId,
      interfaceId: `IF-${randomUUID()}`,
      interfaceName: "상세 조회 테스트",
      startedAt: "2026-07-05T00:00:00.000Z",
      endedAt: "2026-07-05T00:00:01.000Z",
      recordCount: 2,
      failedCount: 1,
      result: "PARTIAL",
      errorDetail: "HTTP 목적지 전송 실패: 500",
      records: [
        { id: "r1", payload: { orderNo: "ORD-1" }, status: "SUCCESS" },
        { id: "r2", payload: { orderNo: "ORD-2" }, status: "FAILED", error: "HTTP 목적지 전송 실패: 500" },
      ],
    });
    const detail = await getRunDetail(transactionId);
    expect(detail).toBeDefined();
    expect(detail!.records).toHaveLength(2);
    expect(detail!.records[1].status).toBe("FAILED");
    expect(detail!.records[1].error).toBe("HTTP 목적지 전송 실패: 500");
  });

  it("returns undefined for an unknown transaction id", async () => {
    expect(await getRunDetail("TXN-does-not-exist")).toBeUndefined();
  });

  it("summarizes failed/partial runs per interface within a time range", async () => {
    const interfaceId = `IF-${randomUUID()}`;
    const now = new Date();
    const from = new Date(now.getTime() - 3600_000).toISOString();
    const to = new Date(now.getTime() + 3600_000).toISOString();

    await recordRun({
      transactionId: `TXN-${randomUUID()}`,
      interfaceId,
      interfaceName: "정산 연계",
      startedAt: now.toISOString(),
      endedAt: now.toISOString(),
      recordCount: 2,
      failedCount: 2,
      result: "FAILED",
      errorDetail: "HTTP 목적지 전송 실패: 500 Internal Server Error",
    });
    await recordRun({
      transactionId: `TXN-${randomUUID()}`,
      interfaceId,
      interfaceName: "정산 연계",
      startedAt: now.toISOString(),
      endedAt: now.toISOString(),
      recordCount: 1,
      failedCount: 0,
      result: "SUCCESS",
      errorDetail: null,
    });

    const summary = await summarizeRange(from, to);
    const entry = summary.find((s) => s.interfaceId === interfaceId);
    expect(entry).toBeDefined();
    expect(entry!.runs).toBe(2);
    expect(entry!.failedRuns).toBe(1);
    expect(entry!.successRuns).toBe(1);
    expect(entry!.sampleErrors).toEqual(["HTTP 목적지 전송 실패: 500 Internal Server Error"]);
  });

  it("excludes runs outside the requested range", async () => {
    const interfaceId = `IF-${randomUUID()}`;
    const farPast = new Date(Date.now() - 10 * 86_400_000).toISOString();
    await recordRun({
      transactionId: `TXN-${randomUUID()}`,
      interfaceId,
      interfaceName: "오래된 연계",
      startedAt: farPast,
      endedAt: farPast,
      recordCount: 1,
      failedCount: 0,
      result: "SUCCESS",
      errorDetail: null,
    });
    const now = new Date();
    const summary = await summarizeRange(
      new Date(now.getTime() - 3600_000).toISOString(),
      new Date(now.getTime() + 3600_000).toISOString(),
    );
    expect(summary.find((s) => s.interfaceId === interfaceId)).toBeUndefined();
  });

  it("paginates runs for one interface, newest first, with correct totals", async () => {
    const interfaceId = `IF-${randomUUID()}`;
    const base = Date.now();
    for (let i = 0; i < 25; i++) {
      await recordRun({
        transactionId: `TXN-${randomUUID()}`,
        interfaceId,
        interfaceName: "페이징 테스트",
        startedAt: new Date(base + i * 1000).toISOString(),
        endedAt: new Date(base + i * 1000).toISOString(),
        recordCount: 1,
        failedCount: 0,
        result: "SUCCESS",
        errorDetail: null,
      });
    }

    const page1 = await getRunsPage(1, 10, interfaceId);
    expect(page1.total).toBe(25);
    expect(page1.totalPages).toBe(3);
    expect(page1.rows).toHaveLength(10);
    // newest first: the last-inserted (i=24) transaction should lead page 1
    expect(page1.rows[0].startedAt).toBe(new Date(base + 24 * 1000).toISOString());

    const page3 = await getRunsPage(3, 10, interfaceId);
    expect(page3.rows).toHaveLength(5);
  });

  it("resends a failed record and recomputes the run to SUCCESS when it was the only failure", async () => {
    const transactionId = `TXN-${randomUUID()}`;
    await recordRun({
      transactionId,
      interfaceId: `IF-${randomUUID()}`,
      interfaceName: "재전송 테스트",
      startedAt: "2026-07-05T00:00:00.000Z",
      endedAt: "2026-07-05T00:00:01.000Z",
      recordCount: 2,
      failedCount: 1,
      result: "PARTIAL",
      errorDetail: "HTTP 목적지 전송 실패: 500",
      records: [
        { id: "r1", payload: { orderNo: "ORD-1" }, status: "SUCCESS" },
        { id: "r2", payload: { orderNo: "ORD-2" }, status: "FAILED", error: "HTTP 목적지 전송 실패: 500" },
      ],
    });

    const updated = await resendRecord(transactionId, "r2");
    expect(updated).toBeDefined();
    expect(updated!.records.find((r) => r.id === "r2")!.status).toBe("SUCCESS");
    expect(updated!.records.find((r) => r.id === "r2")!.error).toBeUndefined();
    expect(updated!.failedCount).toBe(0);
    expect(updated!.result).toBe("SUCCESS");
    expect(updated!.errorDetail).toBeNull();

    const persisted = await getRunDetail(transactionId);
    expect(persisted!.result).toBe("SUCCESS");
    expect(persisted!.failedCount).toBe(0);
  });

  it("recomputes to PARTIAL (not SUCCESS) when other records are still failed", async () => {
    const transactionId = `TXN-${randomUUID()}`;
    await recordRun({
      transactionId,
      interfaceId: `IF-${randomUUID()}`,
      interfaceName: "부분 재전송 테스트",
      startedAt: "2026-07-05T00:00:00.000Z",
      endedAt: "2026-07-05T00:00:01.000Z",
      recordCount: 3,
      failedCount: 2,
      result: "PARTIAL",
      errorDetail: "에러 A",
      records: [
        { id: "a", payload: {}, status: "SUCCESS" },
        { id: "b", payload: {}, status: "FAILED", error: "에러 A" },
        { id: "c", payload: {}, status: "FAILED", error: "에러 B" },
      ],
    });

    const updated = await resendRecord(transactionId, "b");
    expect(updated!.result).toBe("PARTIAL");
    expect(updated!.failedCount).toBe(1);
    expect(updated!.errorDetail).toBe("에러 B");
  });

  it("returns undefined when resending a record on an unknown transaction", async () => {
    expect(await resendRecord("TXN-does-not-exist", "r1")).toBeUndefined();
  });
});
