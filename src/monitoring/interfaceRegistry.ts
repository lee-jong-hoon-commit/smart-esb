import { db } from "../db/index.js";
import type { ConnectorConfig, ConnectorType, InterfaceRegistryEntry } from "./connectorTypes.js";

interface InterfaceRow {
  interface_id: string;
  interface_name: string;
  connector_type: string;
  config_json: string;
  created_at: string;
}

function rowToEntry(row: InterfaceRow): InterfaceRegistryEntry {
  return {
    interfaceId: row.interface_id,
    interfaceName: row.interface_name,
    connectorType: row.connector_type as ConnectorType,
    config: JSON.parse(row.config_json),
    createdAt: row.created_at,
  };
}

export interface UpsertInterfaceInput {
  interfaceId: string;
  interfaceName: string;
  connectorType: ConnectorType;
  config: ConnectorConfig;
}

export async function upsertInterface(input: UpsertInterfaceInput): Promise<void> {
  db.prepare(
    `INSERT INTO interfaces (interface_id, interface_name, connector_type, config_json, created_at)
     VALUES (@interfaceId, @interfaceName, @connectorType, @configJson, @createdAt)
     ON CONFLICT(interface_id) DO UPDATE SET
       interface_name = excluded.interface_name,
       connector_type = excluded.connector_type,
       config_json = excluded.config_json`,
  ).run({
    interfaceId: input.interfaceId,
    interfaceName: input.interfaceName,
    connectorType: input.connectorType,
    configJson: JSON.stringify(input.config),
    createdAt: new Date().toISOString(),
  });
}

export async function listInterfaces(): Promise<InterfaceRegistryEntry[]> {
  const rows = db.prepare("SELECT * FROM interfaces ORDER BY interface_name ASC").all() as InterfaceRow[];
  return rows.map(rowToEntry);
}

export async function getInterface(interfaceId: string): Promise<InterfaceRegistryEntry | undefined> {
  const row = db.prepare("SELECT * FROM interfaces WHERE interface_id = ?").get(interfaceId) as
    | InterfaceRow
    | undefined;
  return row ? rowToEntry(row) : undefined;
}
