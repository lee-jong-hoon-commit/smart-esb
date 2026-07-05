import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

let recordRun: (typeof import("../src/monitoring/logStore.js"))["recordRun"];
let getRecentRuns: (typeof import("../src/monitoring/logStore.js"))["getRecentRuns"];
let summarizeRange: (typeof import("../src/monitoring/logStore.js"))["summarizeRange"];

// env vars must be set before db/index.js (via config.js) is first imported, since it reads
// process.env once at module load and stays cached for the process.
beforeAll(async () => {
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "smart-esb-test-"));
  const logStore = await import("../src/monitoring/logStore.js");
  recordRun = logStore.recordRun;
  getRecentRuns = logStore.getRecentRuns;
  summarizeRange = logStore.summarizeRange;
});

describe("logStore", () => {
  it("records and retrieves runs for a flow", async () => {
    const flowId = randomUUID();
    await recordRun({
      flowId,
      flowName: "테스트 연계",
      timestamp: new Date().toISOString(),
      durationMs: 12,
      received: 3,
      success: 2,
      failed: 1,
      errors: ["목적지 전송 실패: 500"],
    });
    const runs = await getRecentRuns(10, flowId);
    expect(runs).toHaveLength(1);
    expect(runs[0].flowName).toBe("테스트 연계");
    expect(runs[0].errors).toEqual(["목적지 전송 실패: 500"]);
  });

  it("summarizes failures per flow within a time range", async () => {
    const flowId = randomUUID();
    const now = new Date();
    const from = new Date(now.getTime() - 3600_000).toISOString();
    const to = new Date(now.getTime() + 3600_000).toISOString();

    await recordRun({
      flowId,
      flowName: "정산 연계",
      timestamp: now.toISOString(),
      durationMs: 5,
      received: 2,
      success: 1,
      failed: 1,
      errors: ["HTTP 목적지 전송 실패: 500 Internal Server Error"],
    });
    await recordRun({
      flowId,
      flowName: "정산 연계",
      timestamp: now.toISOString(),
      durationMs: 5,
      received: 1,
      success: 1,
      failed: 0,
      errors: [],
    });

    const summary = await summarizeRange(from, to);
    const entry = summary.find((s) => s.flowId === flowId);
    expect(entry).toBeDefined();
    expect(entry!.runs).toBe(2);
    expect(entry!.failed).toBe(1);
    expect(entry!.sampleErrors).toEqual(["HTTP 목적지 전송 실패: 500 Internal Server Error"]);
  });

  it("excludes runs outside the requested range", async () => {
    const flowId = randomUUID();
    const farPast = new Date(Date.now() - 10 * 86_400_000).toISOString();
    await recordRun({
      flowId,
      flowName: "오래된 연계",
      timestamp: farPast,
      durationMs: 1,
      received: 1,
      success: 1,
      failed: 0,
      errors: [],
    });
    const now = new Date();
    const summary = await summarizeRange(
      new Date(now.getTime() - 3600_000).toISOString(),
      new Date(now.getTime() + 3600_000).toISOString(),
    );
    expect(summary.find((s) => s.flowId === flowId)).toBeUndefined();
  });
});
