import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pingOllama } from "./ai/client.js";
import { anomaliesRouter, metricsRouter } from "./routes/metrics.js";
import { flowsRouter } from "./routes/flows.js";
import { mappingRouter } from "./routes/mapping.js";
import { routingRouter } from "./routes/routing.js";
import { webhookRouter } from "./routes/webhook.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(projectRoot, "public");

export function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", async (_req, res) => {
    res.json({ status: "ok", ollamaReachable: await pingOllama() });
  });

  app.use("/api/flows", flowsRouter);
  app.use("/api/mapping", mappingRouter);
  app.use("/api/metrics", metricsRouter);
  app.use("/api/anomalies", anomaliesRouter);
  app.use("/api/routing", routingRouter);
  app.use("/webhook", webhookRouter);

  app.use(express.static(publicDir));

  return app;
}
