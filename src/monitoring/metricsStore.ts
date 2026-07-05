import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import type { FlowRunMetric } from "./types.js";

const MAX_HISTORY_PER_FLOW = 500;
const metricsFile = path.join(config.dataDir, "metrics.json");

let store: Record<string, FlowRunMetric[]> = {};
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  try {
    const raw = await fs.readFile(metricsFile, "utf-8");
    store = JSON.parse(raw);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    store = {};
  }
  loaded = true;
}

async function persist(): Promise<void> {
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.writeFile(metricsFile, JSON.stringify(store, null, 2), "utf-8");
}

export async function recordRun(metric: FlowRunMetric): Promise<void> {
  await ensureLoaded();
  const history = store[metric.flowId] ?? [];
  history.push(metric);
  if (history.length > MAX_HISTORY_PER_FLOW) history.shift();
  store[metric.flowId] = history;
  await persist();
}

export async function getHistory(flowId: string): Promise<FlowRunMetric[]> {
  await ensureLoaded();
  return store[flowId] ?? [];
}

export async function getAllFlowIds(): Promise<string[]> {
  await ensureLoaded();
  return Object.keys(store);
}
