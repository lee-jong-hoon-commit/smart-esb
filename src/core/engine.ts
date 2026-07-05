import { createDestination, createSource } from "../connectors/registry.js";
import { recordRun } from "../monitoring/logStore.js";
import { applyMapping } from "../transform/mapper.js";
import type { FlowDefinition, FlowRunResult, Message } from "./types.js";

async function processMessage(flow: FlowDefinition, message: Message): Promise<{ ok: boolean; error?: string }> {
  try {
    const destination = createDestination(flow.destination);
    const payload = flow.mapping ? applyMapping(message.payload, flow.mapping) : message.payload;
    await destination.send({ ...message, payload });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function tally(outcomes: { ok: boolean; error?: string }[]) {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const o of outcomes) {
    if (o.ok) success++;
    else {
      failed++;
      if (o.error) errors.push(o.error);
    }
  }
  return { success, failed, errors };
}

export async function runFlow(flow: FlowDefinition): Promise<FlowRunResult> {
  const startedAt = new Date().toISOString();
  const start = Date.now();

  let messages: Message[];
  let sourceError: string | undefined;
  try {
    const source = createSource(flow.id, flow.source);
    messages = await source.receive();
  } catch (err) {
    messages = [];
    sourceError = err instanceof Error ? err.message : String(err);
  }

  const outcomes = sourceError ? [] : await Promise.all(messages.map((message) => processMessage(flow, message)));
  const { success, failed, errors } = tally(outcomes);
  if (sourceError) errors.unshift(`소스 조회 실패: ${sourceError}`);

  const durationMs = Date.now() - start;
  const result: FlowRunResult = {
    flowId: flow.id,
    startedAt,
    durationMs,
    received: messages.length,
    success,
    failed: failed + (sourceError ? 1 : 0),
    errors,
  };

  await recordRun({
    flowId: flow.id,
    flowName: flow.name,
    timestamp: startedAt,
    durationMs,
    received: result.received,
    success: result.success,
    failed: result.failed,
    errors: result.errors,
  });

  return result;
}

export async function runFlowForMessage(flow: FlowDefinition, message: Message): Promise<FlowRunResult> {
  const startedAt = new Date().toISOString();
  const start = Date.now();

  const { ok, error } = await processMessage(flow, message);
  const durationMs = Date.now() - start;
  const result: FlowRunResult = {
    flowId: flow.id,
    startedAt,
    durationMs,
    received: 1,
    success: ok ? 1 : 0,
    failed: ok ? 0 : 1,
    errors: error ? [error] : [],
  };

  await recordRun({
    flowId: flow.id,
    flowName: flow.name,
    timestamp: startedAt,
    durationMs,
    received: 1,
    success: result.success,
    failed: result.failed,
    errors: result.errors,
  });

  return result;
}
