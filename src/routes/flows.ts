import { Router } from "express";
import { runFlow } from "../core/engine.js";
import { createFlow, deleteFlow, getFlow, listFlows } from "../core/registry.js";
import { refreshScheduler } from "../core/scheduler.js";
import { FlowCreateInputSchema } from "../core/types.js";

export const flowsRouter = Router();

flowsRouter.get("/", async (_req, res) => {
  res.json(await listFlows());
});

flowsRouter.post("/", async (req, res) => {
  const parsed = FlowCreateInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const flow = await createFlow(parsed.data);
  await refreshScheduler();
  res.status(201).json(flow);
});

flowsRouter.get("/:id", async (req, res) => {
  const flow = await getFlow(req.params.id);
  if (!flow) {
    res.status(404).json({ error: "flow not found" });
    return;
  }
  res.json(flow);
});

flowsRouter.delete("/:id", async (req, res) => {
  const deleted = await deleteFlow(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "flow not found" });
    return;
  }
  await refreshScheduler();
  res.status(204).send();
});

flowsRouter.post("/:id/run", async (req, res) => {
  const flow = await getFlow(req.params.id);
  if (!flow) {
    res.status(404).json({ error: "flow not found" });
    return;
  }
  try {
    const result = await runFlow(flow);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
