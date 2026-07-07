import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

let upsertNode: (typeof import("../src/monitoring/nodeRegistry.js"))["upsertNode"];
let getNode: (typeof import("../src/monitoring/nodeRegistry.js"))["getNode"];
let deleteNode: (typeof import("../src/monitoring/nodeRegistry.js"))["deleteNode"];
let listNodesPage: (typeof import("../src/monitoring/nodeRegistry.js"))["listNodesPage"];
let validateNodeConfig: (typeof import("../src/monitoring/nodeConfigValidation.js"))["validateNodeConfig"];
let NodeConfigValidationError: (typeof import("../src/monitoring/nodeConfigValidation.js"))["NodeConfigValidationError"];

beforeAll(async () => {
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "smart-esb-test-"));
  const nodeRegistry = await import("../src/monitoring/nodeRegistry.js");
  const validation = await import("../src/monitoring/nodeConfigValidation.js");
  upsertNode = nodeRegistry.upsertNode;
  getNode = nodeRegistry.getNode;
  deleteNode = nodeRegistry.deleteNode;
  listNodesPage = nodeRegistry.listNodesPage;
  validateNodeConfig = validation.validateNodeConfig;
  NodeConfigValidationError = validation.NodeConfigValidationError;
});

describe("validateNodeConfig", () => {
  it("accepts a valid ESB config and strips unknown fields", () => {
    const result = validateNodeConfig("ESB", { port: "8080", version: "3.2.1", extra: "ignored" });
    expect(result).toEqual({ port: 8080, version: "3.2.1" });
  });

  it("rejects an AGENT config missing required fields", () => {
    expect(() => validateNodeConfig("AGENT", { targetSystem: "ERP" })).toThrow(NodeConfigValidationError);
  });

  it("rejects a non-numeric port for ESB", () => {
    expect(() => validateNodeConfig("ESB", { port: "abc", version: "1.0" })).toThrow(NodeConfigValidationError);
  });
});

describe("node CRUD", () => {
  it("creates, updates, and deletes a node", async () => {
    const nodeId = `NODE-${randomUUID()}`;
    await upsertNode({
      nodeId,
      nodeName: "테스트 어댑터",
      nodeType: "ADAPTER",
      host: "10.0.0.1",
      config: { adapterKind: "DB_ADAPTER", version: "1.0.0" },
    });

    const created = await getNode(nodeId);
    expect(created?.nodeName).toBe("테스트 어댑터");
    expect(created?.nodeType).toBe("ADAPTER");

    await upsertNode({
      nodeId,
      nodeName: "테스트 어댑터 (수정됨)",
      nodeType: "ADAPTER",
      host: "10.0.0.2",
      config: { adapterKind: "FILE_ADAPTER", version: "1.1.0" },
    });
    const updated = await getNode(nodeId);
    expect(updated?.nodeName).toBe("테스트 어댑터 (수정됨)");
    expect(updated?.host).toBe("10.0.0.2");
    expect(updated?.config).toEqual({ adapterKind: "FILE_ADAPTER", version: "1.1.0" });

    const deleted = await deleteNode(nodeId);
    expect(deleted).toBe(true);
    expect(await getNode(nodeId)).toBeUndefined();
    expect(await deleteNode(nodeId)).toBe(false);
  });

  it("filters listNodesPage by type and search together, matching id/name/host", async () => {
    const marker = randomUUID();
    const esbId = `NODE-ESB-${marker}`;
    await upsertNode({
      nodeId: esbId,
      nodeName: `노드목록 ESB ${marker}`,
      nodeType: "ESB",
      host: "10.9.9.9",
      config: { port: 8080, version: "1.0" },
    });
    await upsertNode({
      nodeId: `NODE-AGENT-${marker}`,
      nodeName: `노드목록 AGENT ${marker}`,
      nodeType: "AGENT",
      host: "10.9.9.10",
      config: { targetSystem: "ERP", version: "1.0" },
    });

    const esbOnly = await listNodesPage("ESB", 1, 20, marker);
    expect(esbOnly.rows.every((r) => r.nodeType === "ESB")).toBe(true);
    expect(esbOnly.rows.some((r) => r.nodeName.includes(marker))).toBe(true);

    const allTypes = await listNodesPage(undefined, 1, 20, marker);
    expect(allTypes.total).toBeGreaterThanOrEqual(2);

    const byHost = await listNodesPage(undefined, 1, 20, "10.9.9.9");
    expect(byHost.rows.some((r) => r.nodeId === esbId)).toBe(true);
  });
});
