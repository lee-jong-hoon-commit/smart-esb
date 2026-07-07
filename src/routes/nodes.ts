import { Router } from "express";
import { NodeConfigValidationError, validateNodeConfig } from "../monitoring/nodeConfigValidation.js";
import { getNodeStatusPage } from "../monitoring/nodeMonitoring.js";
import { deleteNode, getNode, upsertNode } from "../monitoring/nodeRegistry.js";
import type { NodeType } from "../monitoring/nodeTypes.js";

export const nodesRouter = Router();

const VALID_TYPES: NodeType[] = ["ESB", "AGENT", "ADAPTER"];

function isValidNodeType(value: unknown): value is NodeType {
  return typeof value === "string" && VALID_TYPES.includes(value as NodeType);
}

nodesRouter.get("/", async (req, res) => {
  const type = req.query.type;
  if (type !== undefined && (typeof type !== "string" || !isValidNodeType(type))) {
    res.status(400).json({ error: `type은 ${VALID_TYPES.join("/")} 중 하나이거나 생략(전체)이어야 합니다.` });
    return;
  }
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(Math.max(1, Number(req.query.pageSize ?? 20)), 100);
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  res.json(await getNodeStatusPage(type as NodeType | undefined, page, pageSize, search));
});

nodesRouter.post("/", async (req, res) => {
  const { nodeId, nodeName, nodeType, host, config } = req.body ?? {};
  if (typeof nodeId !== "string" || !nodeId.trim()) {
    res.status(400).json({ error: "nodeId 값이 필요합니다." });
    return;
  }
  if (typeof nodeName !== "string" || !nodeName.trim()) {
    res.status(400).json({ error: "nodeName 값이 필요합니다." });
    return;
  }
  if (typeof host !== "string" || !host.trim()) {
    res.status(400).json({ error: "host 값이 필요합니다." });
    return;
  }
  if (!isValidNodeType(nodeType)) {
    res.status(400).json({ error: `nodeType은 ${VALID_TYPES.join("/")} 중 하나여야 합니다.` });
    return;
  }
  if (await getNode(nodeId)) {
    res.status(409).json({ error: `이미 존재하는 nodeId입니다: ${nodeId}` });
    return;
  }
  try {
    const validatedConfig = validateNodeConfig(nodeType, config);
    await upsertNode({ nodeId, nodeName, nodeType, host, config: validatedConfig });
    res.status(201).json(await getNode(nodeId));
  } catch (err) {
    if (err instanceof NodeConfigValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

nodesRouter.put("/:nodeId", async (req, res) => {
  const { nodeId } = req.params;
  const existing = await getNode(nodeId);
  if (!existing) {
    res.status(404).json({ error: "node not found" });
    return;
  }
  const { nodeName, nodeType, host, config } = req.body ?? {};
  if (typeof nodeName !== "string" || !nodeName.trim()) {
    res.status(400).json({ error: "nodeName 값이 필요합니다." });
    return;
  }
  if (typeof host !== "string" || !host.trim()) {
    res.status(400).json({ error: "host 값이 필요합니다." });
    return;
  }
  if (!isValidNodeType(nodeType)) {
    res.status(400).json({ error: `nodeType은 ${VALID_TYPES.join("/")} 중 하나여야 합니다.` });
    return;
  }
  try {
    const validatedConfig = validateNodeConfig(nodeType, config);
    await upsertNode({ nodeId, nodeName, nodeType, host, config: validatedConfig });
    res.json(await getNode(nodeId));
  } catch (err) {
    if (err instanceof NodeConfigValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

nodesRouter.delete("/:nodeId", async (req, res) => {
  const deleted = await deleteNode(req.params.nodeId);
  if (!deleted) {
    res.status(404).json({ error: "node not found" });
    return;
  }
  res.status(204).end();
});
