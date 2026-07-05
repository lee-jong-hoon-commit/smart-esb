import { Router } from "express";
import { explainAnomaly } from "../ai/anomalyExplainer.js";
import { detectAnomalies } from "../monitoring/anomalyDetector.js";
import { getAllFlowIds, getHistory } from "../monitoring/metricsStore.js";

export const metricsRouter = Router();

metricsRouter.get("/:flowId", async (req, res) => {
  res.json(await getHistory(req.params.flowId));
});

metricsRouter.get("/:flowId/anomalies", async (req, res) => {
  const anomalies = await detectAnomalies(req.params.flowId);
  const explain = req.query.explain === "true";
  if (!explain) {
    res.json(anomalies);
    return;
  }
  const withExplanations = await Promise.all(
    anomalies.map(async (anomaly) => ({ ...anomaly, explanation: await explainAnomaly(anomaly) })),
  );
  res.json(withExplanations);
});

export const anomaliesRouter = Router();

anomaliesRouter.get("/", async (_req, res) => {
  const flowIds = await getAllFlowIds();
  const results = await Promise.all(
    flowIds.map(async (flowId) => ({ flowId, anomalies: await detectAnomalies(flowId) })),
  );
  res.json(results.filter((r) => r.anomalies.length > 0));
});
