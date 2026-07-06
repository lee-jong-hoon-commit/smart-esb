import { Router } from "express";
import { getStats } from "../monitoring/statsAggregator.js";

export const statsRouter = Router();

statsRouter.get("/", async (req, res) => {
  const days = Math.min(Math.max(1, Number(req.query.days ?? 7)), 90);
  res.json(await getStats(days));
});
