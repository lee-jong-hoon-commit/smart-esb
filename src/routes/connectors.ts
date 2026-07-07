import { Router } from "express";
import { getConnectorStatsPage } from "../monitoring/connectorStats.js";
import type { ConnectorType } from "../monitoring/connectorTypes.js";

export const connectorsRouter = Router();

const VALID_TYPES: ConnectorType[] = ["QUEUE", "HTTP", "DB", "FILE"];

connectorsRouter.get("/", async (req, res) => {
  const type = req.query.type;
  // type을 생략하면 모든 커넥터 타입을 대상으로 검색합니다 ("전체" 탭용).
  if (type !== undefined && (typeof type !== "string" || !VALID_TYPES.includes(type as ConnectorType))) {
    res.status(400).json({ error: `type은 ${VALID_TYPES.join("/")} 중 하나이거나 생략(전체)이어야 합니다.` });
    return;
  }
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(Math.max(1, Number(req.query.pageSize ?? 20)), 100);
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  res.json(await getConnectorStatsPage(type as ConnectorType | undefined, page, pageSize, search));
});
