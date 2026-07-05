import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import type { ConnectorConfig, FlowCreateInput, FlowDefinition } from "./types.js";

interface FlowRow {
  id: string;
  name: string;
  source_json: string;
  destination_json: string;
  mapping_json: string | null;
  routing_json: string | null;
  created_at: string;
  updated_at: string;
}

function rowToFlow(row: FlowRow): FlowDefinition {
  return {
    id: row.id,
    name: row.name,
    source: JSON.parse(row.source_json),
    destination: JSON.parse(row.destination_json),
    mapping: row.mapping_json ? JSON.parse(row.mapping_json) : undefined,
    routing: row.routing_json ? JSON.parse(row.routing_json) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createFlow(input: FlowCreateInput): Promise<FlowDefinition> {
  const now = new Date().toISOString();
  const flow: FlowDefinition = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
  db.prepare(
    `INSERT INTO flows (id, name, source_json, destination_json, mapping_json, routing_json, created_at, updated_at)
     VALUES (@id, @name, @source_json, @destination_json, @mapping_json, @routing_json, @created_at, @updated_at)`,
  ).run({
    id: flow.id,
    name: flow.name,
    source_json: JSON.stringify(flow.source),
    destination_json: JSON.stringify(flow.destination),
    mapping_json: flow.mapping ? JSON.stringify(flow.mapping) : null,
    routing_json: flow.routing ? JSON.stringify(flow.routing) : null,
    created_at: flow.createdAt,
    updated_at: flow.updatedAt,
  });
  return flow;
}

export async function listFlows(): Promise<FlowDefinition[]> {
  const rows = db.prepare("SELECT * FROM flows ORDER BY created_at DESC").all() as FlowRow[];
  return rows.map(rowToFlow);
}

export async function getFlow(id: string): Promise<FlowDefinition | undefined> {
  const row = db.prepare("SELECT * FROM flows WHERE id = ?").get(id) as FlowRow | undefined;
  return row ? rowToFlow(row) : undefined;
}

export async function deleteFlow(id: string): Promise<boolean> {
  const result = db.prepare("DELETE FROM flows WHERE id = ?").run(id);
  return result.changes > 0;
}

function isMemorySource(source: ConnectorConfig): source is Extract<ConnectorConfig, { type: "memory" }> {
  return source.type === "memory";
}

export async function findFlowsByMemoryQueue(queue: string): Promise<FlowDefinition[]> {
  const rows = db.prepare("SELECT * FROM flows").all() as FlowRow[];
  return rows.map(rowToFlow).filter((flow) => isMemorySource(flow.source) && flow.source.queue === queue);
}
