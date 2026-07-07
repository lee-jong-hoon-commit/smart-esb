import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

let upsertInterface: (typeof import("../src/monitoring/interfaceRegistry.js"))["upsertInterface"];
let getInterface: (typeof import("../src/monitoring/interfaceRegistry.js"))["getInterface"];
let deleteInterface: (typeof import("../src/monitoring/interfaceRegistry.js"))["deleteInterface"];
let listInterfacesPage: (typeof import("../src/monitoring/interfaceRegistry.js"))["listInterfacesPage"];
let validateConnectorConfig: (typeof import("../src/monitoring/connectorConfigValidation.js"))["validateConnectorConfig"];
let ConfigValidationError: (typeof import("../src/monitoring/connectorConfigValidation.js"))["ConfigValidationError"];

beforeAll(async () => {
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "smart-esb-test-"));
  const interfaceRegistry = await import("../src/monitoring/interfaceRegistry.js");
  const validation = await import("../src/monitoring/connectorConfigValidation.js");
  upsertInterface = interfaceRegistry.upsertInterface;
  getInterface = interfaceRegistry.getInterface;
  deleteInterface = interfaceRegistry.deleteInterface;
  listInterfacesPage = interfaceRegistry.listInterfacesPage;
  validateConnectorConfig = validation.validateConnectorConfig;
  ConfigValidationError = validation.ConfigValidationError;
});

describe("validateConnectorConfig", () => {
  it("accepts a valid HTTP config and strips unknown fields", () => {
    const result = validateConnectorConfig("HTTP", {
      url: "http://example.com",
      method: "POST",
      serviceIp: "10.0.0.1",
      timeoutMs: "1500",
      unknownField: "ignored",
    });
    expect(result).toEqual({ url: "http://example.com", method: "POST", serviceIp: "10.0.0.1", timeoutMs: 1500 });
  });

  it("rejects a QUEUE config missing required fields", () => {
    expect(() => validateConnectorConfig("QUEUE", { source: "A" })).toThrow(ConfigValidationError);
  });

  it("rejects a non-numeric pollIntervalSec for DB", () => {
    expect(() =>
      validateConnectorConfig("DB", { table: "t", watermarkColumn: "id", pollIntervalSec: "abc" }),
    ).toThrow(ConfigValidationError);
  });
});

describe("interface CRUD", () => {
  it("creates, updates, and deletes an interface", async () => {
    const interfaceId = `IF-${randomUUID()}`;
    await upsertInterface({
      interfaceId,
      interfaceName: "관리 화면 테스트 인터페이스",
      connectorType: "FILE",
      config: { path: "/data/test.json" },
    });

    const created = await getInterface(interfaceId);
    expect(created?.interfaceName).toBe("관리 화면 테스트 인터페이스");
    expect(created?.connectorType).toBe("FILE");

    await upsertInterface({
      interfaceId,
      interfaceName: "관리 화면 테스트 인터페이스 (수정됨)",
      connectorType: "FILE",
      config: { path: "/data/test-updated.json", pollIntervalSec: 60 },
    });
    const updated = await getInterface(interfaceId);
    expect(updated?.interfaceName).toBe("관리 화면 테스트 인터페이스 (수정됨)");
    expect(updated?.config).toEqual({ path: "/data/test-updated.json", pollIntervalSec: 60 });

    const deleted = await deleteInterface(interfaceId);
    expect(deleted).toBe(true);
    expect(await getInterface(interfaceId)).toBeUndefined();
    expect(await deleteInterface(interfaceId)).toBe(false);
  });

  it("filters listInterfacesPage by type and search together", async () => {
    const marker = randomUUID();
    await upsertInterface({
      interfaceId: `IF-${randomUUID()}`,
      interfaceName: `관리목록 DB ${marker}`,
      connectorType: "DB",
      config: { table: "t", watermarkColumn: "id" },
    });
    await upsertInterface({
      interfaceId: `IF-${randomUUID()}`,
      interfaceName: `관리목록 QUEUE ${marker}`,
      connectorType: "QUEUE",
      config: { source: "A", destination: "B", queueName: "q" },
    });

    const dbOnly = await listInterfacesPage("DB", 1, 20, marker);
    expect(dbOnly.rows.every((r) => r.connectorType === "DB")).toBe(true);
    expect(dbOnly.rows.some((r) => r.interfaceName.includes(marker))).toBe(true);

    const allTypes = await listInterfacesPage(undefined, 1, 20, marker);
    expect(allTypes.total).toBeGreaterThanOrEqual(2);
  });
});
