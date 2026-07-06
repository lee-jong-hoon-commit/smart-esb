import { Router } from "express";
import { getConnectorTypeStats, getDailyStats, getInterfaceStatsPage } from "../monitoring/statsAggregator.js";

export const statsRouter = Router();

function parseDays(value: unknown): number {
  return Math.min(Math.max(1, Number(value ?? 7)), 365);
}

statsRouter.get("/daily", async (req, res) => {
  res.json(await getDailyStats(parseDays(req.query.days)));
});

statsRouter.get("/by-type", async (req, res) => {
  res.json(await getConnectorTypeStats(parseDays(req.query.days)));
});

statsRouter.get("/by-interface", async (req, res) => {
  const days = parseDays(req.query.days);
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(Math.max(1, Number(req.query.pageSize ?? 20)), 100);
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  res.json(await getInterfaceStatsPage(days, page, pageSize, search));
});
