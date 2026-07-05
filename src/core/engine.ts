import { createDestination, createSource } from "../connectors/registry.js";
import { recordRun } from "../monitoring/metricsStore.js";
import { applyMapping } from "../transform/mapper.js";
import { matchesRouting } from "../transform/routing.js";
import type { FlowDefinition, FlowRunResult, Message } from "./types.js";

type MessageOutcome = "success" | "failed" | "filtered";

async function processMessage(
  flow: FlowDefinition,
  message: Message,
): Promise<{ outcome: MessageOutcome; error?: string }> {
  if (flow.routing && !matchesRouting(message.payload, flow.routing)) {
    return { outcome: "filtered" };
  }
  try {
    const destination = createDestination(flow.destination);
    const payload = flow.mapping ? applyMapping(message.payload, flow.mapping) : message.payload;
    await destination.send({ ...message, payload });
    return { outcome: "success" };
  } catch (err) {
    return { outcome: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}

function tally(outcomes: { outcome: MessageOutcome; error?: string }[]) {
  let success = 0;
  let failed = 0;
  let filtered = 0;
  const errors: string[] = [];
  for (const o of outcomes) {
    if (o.outcome === "success") success++;
    else if (o.outcome === "filtered") filtered++;
    else {
      failed++;
      if (o.error) errors.push(o.error);
    }
  }
  return { success, failed, filtered, errors };
}

export async function runFlow(flow: FlowDefinition): Promise<FlowRunResult> {
  const startedAt = new Date().toISOString();
  const start = Date.now();

  const source = createSource(flow.source);
  const messages = await source.receive();
  const outcomes = await Promise.all(messages.map((message) => processMessage(flow, message)));
  const { success, failed, filtered, errors } = tally(outcomes);

  const durationMs = Date.now() - start;
  const result: FlowRunResult = {
    flowId: flow.id,
    startedAt,
    durationMs,
    received: messages.length,
    success,
    failed,
    filtered,
    errors,
  };

  await recordRun({
    flowId: flow.id,
    timestamp: startedAt,
    durationMs,
    received: messages.length,
    success,
    failed,
    filtered,
  });

  return result;
}

export async function runFlowForMessage(flow: FlowDefinition, message: Message): Promise<FlowRunResult> {
  const startedAt = new Date().toISOString();
  const start = Date.now();

  const { outcome, error } = await processMessage(flow, message);
  const durationMs = Date.now() - start;
  const result: FlowRunResult = {
    flowId: flow.id,
    startedAt,
    durationMs,
    received: 1,
    success: outcome === "success" ? 1 : 0,
    failed: outcome === "failed" ? 1 : 0,
    filtered: outcome === "filtered" ? 1 : 0,
    errors: error ? [error] : [],
  };

  await recordRun({
    flowId: flow.id,
    timestamp: startedAt,
    durationMs,
    received: 1,
    success: result.success,
    failed: result.failed,
    filtered: result.filtered,
  });

  return result;
}
