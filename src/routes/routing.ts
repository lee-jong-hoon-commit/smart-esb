import { Router } from "express";
import { z } from "zod";
import { generateRoutingCondition } from "../ai/routingRuleGenerator.js";
import { RoutingConditionSchema } from "../core/types.js";
import { matchesRouting } from "../transform/routing.js";

export const routingRouter = Router();

const GenerateRoutingRequestSchema = z.object({
  sample: z.unknown(),
  description: z.string().min(1),
});

routingRouter.post("/generate", async (req, res) => {
  const parsed = GenerateRoutingRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const routing = await generateRoutingCondition(parsed.data.sample, parsed.data.description);
    res.json({ routing });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

const PreviewRoutingRequestSchema = z.object({
  sample: z.unknown(),
  routing: RoutingConditionSchema,
});

routingRouter.post("/preview", (req, res) => {
  const parsed = PreviewRoutingRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  res.json({ matches: matchesRouting(parsed.data.sample, parsed.data.routing) });
});
