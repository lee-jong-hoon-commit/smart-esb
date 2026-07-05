import { Router } from "express";
import { z } from "zod";
import { createFlow } from "../core/registry.js";
import { refreshScheduler } from "../core/scheduler.js";
import { getTemplate, templates } from "../templates/index.js";

export const templatesRouter = Router();

templatesRouter.get("/", (_req, res) => {
  res.json(templates.map(({ id, name, category, scenario, notes }) => ({ id, name, category, scenario, notes })));
});

templatesRouter.get("/:id", (req, res) => {
  const template = getTemplate(req.params.id);
  if (!template) {
    res.status(404).json({ error: "template not found" });
    return;
  }
  res.json(template);
});

const InstantiateRequestSchema = z.object({ name: z.string().optional() });

templatesRouter.post("/:id/instantiate", async (req, res) => {
  const template = getTemplate(req.params.id);
  if (!template) {
    res.status(404).json({ error: "template not found" });
    return;
  }
  const parsed = InstantiateRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const flow = await createFlow({
    ...template.definition,
    name: parsed.data.name?.trim() || template.definition.name,
    templateId: template.id,
  });
  await refreshScheduler();
  res.status(201).json(flow);
});
