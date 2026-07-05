import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pingOllama } from "./ai/client.js";
import { activeScheduleCount } from "./core/scheduler.js";
import { chatRouter } from "./routes/chat.js";
import { demoRouter } from "./routes/demo.js";
import { flowsRouter } from "./routes/flows.js";
import { mappingRouter } from "./routes/mapping.js";
import { monitoringRouter } from "./routes/monitoring.js";
import { templatesRouter } from "./routes/templates.js";
import { webhookRouter } from "./routes/webhook.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(projectRoot, "public");

export function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", async (_req, res) => {
    res.json({ status: "ok", ollamaReachable: await pingOllama(), activeSchedules: activeScheduleCount() });
  });

  app.use("/api/flows", flowsRouter);
  app.use("/api/templates", templatesRouter);
  app.use("/api/mapping", mappingRouter);
  app.use("/api/monitoring", monitoringRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/_demo", demoRouter);
  app.use("/webhook", webhookRouter);

  app.use(express.static(publicDir));

  return app;
}
