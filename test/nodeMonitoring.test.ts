import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

let upsertNode: (typeof import("../src/monitoring/nodeRegistry.js"))["upsertNode"];
let recordHeartbeat: (typeof import("../src/monitoring/nodeMonitoring.js"))["recordHeartbeat"];
let getNodeStatusPage: (typeof import("../src/monitoring/nodeMonitoring.js"))["getNodeStatusPage"];
let getNodeOverview: (typeof import("../src/monitoring/nodeMonitoring.js"))["getNodeOverview"];
let getResourceUsageSnapshot: (typeof import("../src/monitoring/nodeMonitoring.js"))["getResourceUsageSnapshot"];

beforeAll(async () => {
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "smart-esb-test-"));
  const nodeRegistry = await import("../src/monitoring/nodeRegistry.js");
  const nodeMonitoring = await import("../src/monitoring/nodeMonitoring.js");
  upsertNode = nodeRegistry.upsertNode;
  recordHeartbeat = nodeMonitoring.recordHeartbeat;
  getNodeStatusPage = nodeMonitoring.getNodeStatusPage;
  getNodeOverview = nodeMonitoring.getNodeOverview;
  getResourceUsageSnapshot = nodeMonitoring.getResourceUsageSnapshot;
});

describe("node status + dashboard aggregation", () => {
  it("reports 알수없음 status for a node with no heartbeat yet", async () => {
    const nodeId = `NODE-${randomUUID()}`;
    await upsertNode({
      nodeId,
      nodeName: "하트비트 없는 노드",
      nodeType: "ESB",
      host: "10.1.1.1",
      config: { port: 8080, version: "1.0" },
    });

    const page = await getNodeStatusPage("ESB", 1, 20, nodeId);
    const entry = page.rows.find((r) => r.nodeId === nodeId);
    expect(entry?.status).toBe("알수없음");
    expect(entry?.cpuPct).toBeNull();
    expect(entry?.lastHeartbeatAt).toBeNull();
  });

  it("uses the most recent heartbeat's status and resource usage", async () => {
    const nodeId = `NODE-${randomUUID()}`;
    await upsertNode({
      nodeId,
      nodeName: "정상 노드",
      nodeType: "ADAPTER",
      host: "10.1.1.2",
      config: { adapterKind: "DB_ADAPTER", version: "1.0" },
    });

    const now = new Date();
    await recordHeartbeat({
      nodeId,
      reportedAt: new Date(now.getTime() - 60_000).toISOString(),
      status: "경고",
      cpuPct: 40,
      memPct: 50,
      diskPct: 60,
      uptimeSec: 1000,
    });
    await recordHeartbeat({
      nodeId,
      reportedAt: now.toISOString(),
      status: "정상",
      cpuPct: 20,
      memPct: 30,
      diskPct: 40,
      uptimeSec: 1060,
    });

    const page = await getNodeStatusPage("ADAPTER", 1, 20, nodeId);
    const entry = page.rows.find((r) => r.nodeId === nodeId);
    expect(entry?.status).toBe("정상");
    expect(entry?.cpuPct).toBe(20);
    expect(entry?.lastHeartbeatAt).toBe(now.toISOString());
  });

  it("aggregates node overview by type and by latest status", async () => {
    const marker = randomUUID();
    const okId = `NODE-OK-${marker}`;
    const badId = `NODE-BAD-${marker}`;
    await upsertNode({
      nodeId: okId,
      nodeName: `정상 에이전트 ${marker}`,
      nodeType: "AGENT",
      host: "10.1.1.3",
      config: { targetSystem: "ERP", version: "1.0" },
    });
    await upsertNode({
      nodeId: badId,
      nodeName: `장애 에이전트 ${marker}`,
      nodeType: "AGENT",
      host: "10.1.1.4",
      config: { targetSystem: "ERP", version: "1.0" },
    });
    await recordHeartbeat({
      nodeId: okId,
      reportedAt: new Date().toISOString(),
      status: "정상",
      cpuPct: 10,
      memPct: 20,
      diskPct: 30,
      uptimeSec: 500,
    });
    await recordHeartbeat({
      nodeId: badId,
      reportedAt: new Date().toISOString(),
      status: "장애",
      cpuPct: 95,
      memPct: 90,
      diskPct: 80,
      uptimeSec: 10,
    });

    const overview = await getNodeOverview();
    expect(overview.totalNodes).toBeGreaterThanOrEqual(2);
    const agentType = overview.byType.find((t) => t.nodeType === "AGENT");
    expect(agentType?.count).toBeGreaterThanOrEqual(2);
    const okStatus = overview.byStatus.find((s) => s.status === "정상");
    const badStatus = overview.byStatus.find((s) => s.status === "장애");
    expect(okStatus?.count).toBeGreaterThanOrEqual(1);
    expect(badStatus?.count).toBeGreaterThanOrEqual(1);

    const snapshot = await getResourceUsageSnapshot();
    const badEntry = snapshot.find((r) => r.nodeId === badId);
    expect(badEntry?.status).toBe("장애");
    expect(badEntry?.cpuPct).toBe(95);
  });
});
