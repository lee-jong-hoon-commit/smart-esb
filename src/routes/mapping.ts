import { Router } from "express";
import { z } from "zod";
import { generateMapping } from "../ai/mappingGenerator.js";

export const mappingRouter = Router();

const GenerateMappingRequestSchema = z.object({
  sourceSample: z.unknown(),
  targetSample: z.unknown(),
});

mappingRouter.post("/generate", async (req, res) => {
  const parsed = GenerateMappingRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const mapping = await generateMapping(parsed.data.sourceSample, parsed.data.targetSample);
    res.json({ mapping });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
