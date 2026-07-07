import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chatRouter } from "./routes/chat.js";
import { connectorsRouter } from "./routes/connectors.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { interfacesRouter } from "./routes/interfaces.js";
import { monitoringRouter } from "./routes/monitoring.js";
import { nodesRouter } from "./routes/nodes.js";
import { resourcesRouter } from "./routes/resources.js";
import { statsRouter } from "./routes/stats.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(projectRoot, "public");

export function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/monitoring", monitoringRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/connectors", connectorsRouter);
  app.use("/api/interfaces", interfacesRouter);
  app.use("/api/resources", resourcesRouter);
  app.use("/api/nodes", nodesRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/stats", statsRouter);

  app.use(express.static(publicDir));

  return app;
}
