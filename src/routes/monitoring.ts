import { Router } from "express";
import { getRunDetail, getRunsPage, summarizeRange } from "../monitoring/logStore.js";

export const monitoringRouter = Router();

monitoringRouter.get("/runs", async (req, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(Math.max(1, Number(req.query.pageSize ?? 20)), 100);
  const interfaceId = typeof req.query.interfaceId === "string" ? req.query.interfaceId : undefined;
  res.json(await getRunsPage(page, pageSize, interfaceId));
});

monitoringRouter.get("/runs/:transactionId", async (req, res) => {
  const detail = await getRunDetail(req.params.transactionId);
  if (!detail) {
    res.status(404).json({ error: "transaction not found" });
    return;
  }
  res.json(detail);
});

monitoringRouter.get("/summary", async (req, res) => {
  const to = typeof req.query.to === "string" ? req.query.to : new Date().toISOString();
  const from =
    typeof req.query.from === "string" ? req.query.from : new Date(Date.now() - 24 * 3600_000).toISOString();
  res.json(await summarizeRange(from, to));
});
