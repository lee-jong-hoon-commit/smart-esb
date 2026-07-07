import { Router } from "express";
import { ConfigValidationError, validateConnectorConfig } from "../monitoring/connectorConfigValidation.js";
import type { ConnectorType } from "../monitoring/connectorTypes.js";
import { deleteInterface, getInterface, listInterfacesPage, upsertInterface } from "../monitoring/interfaceRegistry.js";

export const interfacesRouter = Router();

const VALID_TYPES: ConnectorType[] = ["QUEUE", "HTTP", "DB", "FILE"];

function isValidConnectorType(value: unknown): value is ConnectorType {
  return typeof value === "string" && VALID_TYPES.includes(value as ConnectorType);
}

interfacesRouter.get("/", async (req, res) => {
  const type = req.query.type;
  if (type !== undefined && (typeof type !== "string" || !isValidConnectorType(type))) {
    res.status(400).json({ error: `type은 ${VALID_TYPES.join("/")} 중 하나이거나 생략(전체)이어야 합니다.` });
    return;
  }
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(Math.max(1, Number(req.query.pageSize ?? 20)), 100);
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  res.json(await listInterfacesPage(type as ConnectorType | undefined, page, pageSize, search));
});

interfacesRouter.post("/", async (req, res) => {
  const { interfaceId, interfaceName, connectorType, config } = req.body ?? {};
  if (typeof interfaceId !== "string" || !interfaceId.trim()) {
    res.status(400).json({ error: "interfaceId 값이 필요합니다." });
    return;
  }
  if (typeof interfaceName !== "string" || !interfaceName.trim()) {
    res.status(400).json({ error: "interfaceName 값이 필요합니다." });
    return;
  }
  if (!isValidConnectorType(connectorType)) {
    res.status(400).json({ error: `connectorType은 ${VALID_TYPES.join("/")} 중 하나여야 합니다.` });
    return;
  }
  if (await getInterface(interfaceId)) {
    res.status(409).json({ error: `이미 존재하는 interfaceId입니다: ${interfaceId}` });
    return;
  }
  try {
    const validatedConfig = validateConnectorConfig(connectorType, config);
    await upsertInterface({ interfaceId, interfaceName, connectorType, config: validatedConfig });
    res.status(201).json(await getInterface(interfaceId));
  } catch (err) {
    if (err instanceof ConfigValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

interfacesRouter.put("/:interfaceId", async (req, res) => {
  const { interfaceId } = req.params;
  const existing = await getInterface(interfaceId);
  if (!existing) {
    res.status(404).json({ error: "interface not found" });
    return;
  }
  const { interfaceName, connectorType, config } = req.body ?? {};
  if (typeof interfaceName !== "string" || !interfaceName.trim()) {
    res.status(400).json({ error: "interfaceName 값이 필요합니다." });
    return;
  }
  if (!isValidConnectorType(connectorType)) {
    res.status(400).json({ error: `connectorType은 ${VALID_TYPES.join("/")} 중 하나여야 합니다.` });
    return;
  }
  try {
    const validatedConfig = validateConnectorConfig(connectorType, config);
    await upsertInterface({ interfaceId, interfaceName, connectorType, config: validatedConfig });
    res.json(await getInterface(interfaceId));
  } catch (err) {
    if (err instanceof ConfigValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

interfacesRouter.delete("/:interfaceId", async (req, res) => {
  const deleted = await deleteInterface(req.params.interfaceId);
  if (!deleted) {
    res.status(404).json({ error: "interface not found" });
    return;
  }
  res.status(204).end();
});
