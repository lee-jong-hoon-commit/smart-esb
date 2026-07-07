import { Router } from "express";
import { ResourceConfigValidationError, validateResourceConfig } from "../monitoring/resourceConfigValidation.js";
import type { ResourceType } from "../monitoring/resourceTypes.js";
import { deleteResource, getResource, listResourcesPage, upsertResource } from "../monitoring/resourceRegistry.js";

export const resourcesRouter = Router();

const VALID_TYPES: ResourceType[] = ["DB", "JMS"];

function isValidResourceType(value: unknown): value is ResourceType {
  return typeof value === "string" && VALID_TYPES.includes(value as ResourceType);
}

resourcesRouter.get("/", async (req, res) => {
  const type = req.query.type;
  if (type !== undefined && (typeof type !== "string" || !isValidResourceType(type))) {
    res.status(400).json({ error: `type은 ${VALID_TYPES.join("/")} 중 하나이거나 생략(전체)이어야 합니다.` });
    return;
  }
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(Math.max(1, Number(req.query.pageSize ?? 20)), 100);
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  res.json(await listResourcesPage(type as ResourceType | undefined, page, pageSize, search));
});

resourcesRouter.post("/", async (req, res) => {
  const { resourceId, resourceName, resourceType, config } = req.body ?? {};
  if (typeof resourceId !== "string" || !resourceId.trim()) {
    res.status(400).json({ error: "resourceId 값이 필요합니다." });
    return;
  }
  if (typeof resourceName !== "string" || !resourceName.trim()) {
    res.status(400).json({ error: "resourceName 값이 필요합니다." });
    return;
  }
  if (!isValidResourceType(resourceType)) {
    res.status(400).json({ error: `resourceType은 ${VALID_TYPES.join("/")} 중 하나여야 합니다.` });
    return;
  }
  if (await getResource(resourceId)) {
    res.status(409).json({ error: `이미 존재하는 resourceId입니다: ${resourceId}` });
    return;
  }
  try {
    const validatedConfig = validateResourceConfig(resourceType, config);
    await upsertResource({ resourceId, resourceName, resourceType, config: validatedConfig });
    res.status(201).json(await getResource(resourceId));
  } catch (err) {
    if (err instanceof ResourceConfigValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

resourcesRouter.put("/:resourceId", async (req, res) => {
  const { resourceId } = req.params;
  const existing = await getResource(resourceId);
  if (!existing) {
    res.status(404).json({ error: "resource not found" });
    return;
  }
  const { resourceName, resourceType, config } = req.body ?? {};
  if (typeof resourceName !== "string" || !resourceName.trim()) {
    res.status(400).json({ error: "resourceName 값이 필요합니다." });
    return;
  }
  if (!isValidResourceType(resourceType)) {
    res.status(400).json({ error: `resourceType은 ${VALID_TYPES.join("/")} 중 하나여야 합니다.` });
    return;
  }
  try {
    const validatedConfig = validateResourceConfig(resourceType, config);
    await upsertResource({ resourceId, resourceName, resourceType, config: validatedConfig });
    res.json(await getResource(resourceId));
  } catch (err) {
    if (err instanceof ResourceConfigValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

resourcesRouter.delete("/:resourceId", async (req, res) => {
  const deleted = await deleteResource(req.params.resourceId);
  if (!deleted) {
    res.status(404).json({ error: "resource not found" });
    return;
  }
  res.status(204).end();
});
