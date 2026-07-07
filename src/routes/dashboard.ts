import { Router } from "express";
import { getNodeOverview, getResourceUsageSnapshot } from "../monitoring/nodeMonitoring.js";

export const dashboardRouter = Router();

dashboardRouter.get("/overview", async (_req, res) => {
  res.json(await getNodeOverview());
});

dashboardRouter.get("/resource-usage", async (_req, res) => {
  res.json(await getResourceUsageSnapshot());
});
