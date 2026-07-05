import { createDestination, createSource } from "../connectors/registry.js";
import { recordRun } from "../monitoring/metricsStore.js";
import { applyMapping } from "../transform/mapper.js";
import type { FlowDefinition, FlowRunResult } from "./types.js";

export async function runFlow(flow: FlowDefinition): Promise<FlowRunResult> {
  const startedAt = new Date().toISOString();
  const start = Date.now();

  const source = createSource(flow.source);
  const destination = createDestination(flow.destination);

  const messages = await source.receive();
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const message of messages) {
    try {
      const payload = flow.mapping ? applyMapping(message.payload, flow.mapping) : message.payload;
      await destination.send({ ...message, payload });
      success++;
    } catch (err) {
      failed++;
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  const durationMs = Date.now() - start;
  const result: FlowRunResult = {
    flowId: flow.id,
    startedAt,
    durationMs,
    received: messages.length,
    success,
    failed,
    errors,
  };

  await recordRun({
    flowId: flow.id,
    timestamp: startedAt,
    durationMs,
    received: messages.length,
    success,
    failed,
  });

  return result;
}
