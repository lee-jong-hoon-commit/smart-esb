import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import type { FlowCreateInput, FlowDefinition } from "./types.js";

const flowsFile = path.join(config.dataDir, "flows.json");

let flows: Record<string, FlowDefinition> = {};
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  try {
    const raw = await fs.readFile(flowsFile, "utf-8");
    flows = JSON.parse(raw);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    flows = {};
  }
  loaded = true;
}

async function persist(): Promise<void> {
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.writeFile(flowsFile, JSON.stringify(flows, null, 2), "utf-8");
}

export async function createFlow(input: FlowCreateInput): Promise<FlowDefinition> {
  await ensureLoaded();
  const now = new Date().toISOString();
  const flow: FlowDefinition = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
  flows[flow.id] = flow;
  await persist();
  return flow;
}

export async function listFlows(): Promise<FlowDefinition[]> {
  await ensureLoaded();
  return Object.values(flows);
}

export async function getFlow(id: string): Promise<FlowDefinition | undefined> {
  await ensureLoaded();
  return flows[id];
}

export async function deleteFlow(id: string): Promise<boolean> {
  await ensureLoaded();
  if (!flows[id]) return false;
  delete flows[id];
  await persist();
  return true;
}
