import { randomUUID } from "node:crypto";
import { Router } from "express";
import { runFlowForMessage } from "../core/engine.js";
import { findFlowsByMemoryQueue } from "../core/registry.js";

export const webhookRouter = Router();

// 실시간 수신: source가 { type: "memory", queue } 인 Flow는 여기로 들어오는 요청을
// 즉시(폴링 없이) 처리합니다. 같은 큐를 source로 쓰는 Flow가 여러 개면 모두 실행됩니다.
webhookRouter.post("/:queue", async (req, res) => {
  const { queue } = req.params;
  const flows = await findFlowsByMemoryQueue(queue);
  if (flows.length === 0) {
    res.status(404).json({ error: `큐 '${queue}'를 source로 사용하는 flow가 없습니다.` });
    return;
  }

  const message = { id: randomUUID(), timestamp: new Date().toISOString(), payload: req.body };
  const results = await Promise.all(flows.map((flow) => runFlowForMessage(flow, message)));
  res.status(202).json({ queue, triggeredFlows: results.length, results });
});
