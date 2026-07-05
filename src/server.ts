import cors from "cors";
import express from "express";
import { pingOllama } from "./ai/client.js";
import { anomaliesRouter, metricsRouter } from "./routes/metrics.js";
import { flowsRouter } from "./routes/flows.js";
import { mappingRouter } from "./routes/mapping.js";

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

  return app;
}
