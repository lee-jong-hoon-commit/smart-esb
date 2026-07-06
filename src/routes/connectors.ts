import { Router } from "express";
import { getConnectorStats } from "../monitoring/connectorStats.js";

export const connectorsRouter = Router();

connectorsRouter.get("/", async (_req, res) => {
  res.json(await getConnectorStats());
});
