import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

let recordRun: (typeof import("../src/monitoring/metricsStore.js"))["recordRun"];
let detectAnomalies: (typeof import("../src/monitoring/anomalyDetector.js"))["detectAnomalies"];

// env vars must be set before config.js is first imported (by metricsStore/anomalyDetector),
// since it reads process.env once at module load and stays cached for the process.
beforeAll(async () => {
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "smart-esb-test-"));
  process.env.ANOMALY_MIN_SAMPLES = "5";
  process.env.ANOMALY_ZSCORE_THRESHOLD = "2.5";
  const metricsStore = await import("../src/monitoring/metricsStore.js");
  const anomalyDetector = await import("../src/monitoring/anomalyDetector.js");
  recordRun = metricsStore.recordRun;
  detectAnomalies = anomalyDetector.detectAnomalies;
});

describe("detectAnomalies", () => {
  it("reports no anomalies with too few samples", async () => {
    const flowId = randomUUID();
    await recordRun({ flowId, timestamp: "t", durationMs: 100, received: 10, success: 10, failed: 0 });
    expect(await detectAnomalies(flowId)).toEqual([]);
  });

  it("reports no anomalies for stable metrics", async () => {
    const flowId = randomUUID();
    for (let i = 0; i < 6; i++) {
      await recordRun({ flowId, timestamp: "t", durationMs: 100, received: 10, success: 10, failed: 0 });
    }
    expect(await detectAnomalies(flowId)).toEqual([]);
  });

  it("flags a latency spike far outside the historical baseline", async () => {
    const flowId = randomUUID();
    for (let i = 0; i < 6; i++) {
      await recordRun({ flowId, timestamp: "t", durationMs: 100 + i, received: 10, success: 10, failed: 0 });
    }
    await recordRun({ flowId, timestamp: "t", durationMs: 5000, received: 10, success: 10, failed: 0 });
    const anomalies = await detectAnomalies(flowId);
    expect(anomalies.some((a) => a.metric === "durationMs")).toBe(true);
  });

  it("flags an error rate spike", async () => {
    const flowId = randomUUID();
    for (let i = 0; i < 6; i++) {
      await recordRun({ flowId, timestamp: "t", durationMs: 100, received: 10, success: 10, failed: 0 });
    }
    await recordRun({ flowId, timestamp: "t", durationMs: 100, received: 10, success: 0, failed: 10 });
    const anomalies = await detectAnomalies(flowId);
    expect(anomalies.some((a) => a.metric === "errorRate")).toBe(true);
  });
});
