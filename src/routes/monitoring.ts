import { Router } from "express";
import { getRecentRuns, summarizeRange } from "../monitoring/logStore.js";

export const monitoringRouter = Router();

monitoringRouter.get("/runs", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const flowId = typeof req.query.flowId === "string" ? req.query.flowId : undefined;
  res.json(await getRecentRuns(limit, flowId));
});

monitoringRouter.get("/summary", async (req, res) => {
  const to = typeof req.query.to === "string" ? req.query.to : new Date().toISOString();
  const from =
    typeof req.query.from === "string" ? req.query.from : new Date(Date.now() - 24 * 3600_000).toISOString();
  res.json(await summarizeRange(from, to));
});
