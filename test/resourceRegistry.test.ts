import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

let upsertResource: (typeof import("../src/monitoring/resourceRegistry.js"))["upsertResource"];
let getResource: (typeof import("../src/monitoring/resourceRegistry.js"))["getResource"];
let deleteResource: (typeof import("../src/monitoring/resourceRegistry.js"))["deleteResource"];
let listResourcesPage: (typeof import("../src/monitoring/resourceRegistry.js"))["listResourcesPage"];
let validateResourceConfig: (typeof import("../src/monitoring/resourceConfigValidation.js"))["validateResourceConfig"];
let ResourceConfigValidationError: (typeof import("../src/monitoring/resourceConfigValidation.js"))["ResourceConfigValidationError"];

beforeAll(async () => {
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "smart-esb-test-"));
  const resourceRegistry = await import("../src/monitoring/resourceRegistry.js");
  const validation = await import("../src/monitoring/resourceConfigValidation.js");
  upsertResource = resourceRegistry.upsertResource;
  getResource = resourceRegistry.getResource;
  deleteResource = resourceRegistry.deleteResource;
  listResourcesPage = resourceRegistry.listResourcesPage;
  validateResourceConfig = validation.validateResourceConfig;
  ResourceConfigValidationError = validation.ResourceConfigValidationError;
});

describe("validateResourceConfig", () => {
  it("accepts a valid DB config and strips unknown fields", () => {
    const result = validateResourceConfig("DB", {
      host: "10.0.0.1",
      port: "1521",
      database: "ERPDB",
      driver: "oracle",
      username: "reader",
      password: "should-be-ignored",
    });
    expect(result).toEqual({ host: "10.0.0.1", port: 1521, database: "ERPDB", driver: "oracle", username: "reader" });
  });

  it("rejects a JMS config missing required fields", () => {
    expect(() => validateResourceConfig("JMS", { brokerUrl: "tcp://localhost:61616" })).toThrow(
      ResourceConfigValidationError,
    );
  });

  it("rejects a non-numeric port for DB", () => {
    expect(() =>
      validateResourceConfig("DB", { host: "h", port: "abc", database: "d", driver: "mysql", username: "u" }),
    ).toThrow(ResourceConfigValidationError);
  });
});

describe("resource CRUD", () => {
  it("creates, updates, and deletes a resource", async () => {
    const resourceId = `RES-${randomUUID()}`;
    await upsertResource({
      resourceId,
      resourceName: "테스트 DB 리소스",
      resourceType: "DB",
      config: { host: "h1", port: 5432, database: "d1", driver: "postgresql", username: "u1" },
    });

    const created = await getResource(resourceId);
    expect(created?.resourceName).toBe("테스트 DB 리소스");
    expect(created?.resourceType).toBe("DB");

    await upsertResource({
      resourceId,
      resourceName: "테스트 DB 리소스 (수정됨)",
      resourceType: "DB",
      config: { host: "h2", port: 5433, database: "d2", driver: "postgresql", username: "u2" },
    });
    const updated = await getResource(resourceId);
    expect(updated?.resourceName).toBe("테스트 DB 리소스 (수정됨)");
    expect(updated?.config).toEqual({ host: "h2", port: 5433, database: "d2", driver: "postgresql", username: "u2" });

    const deleted = await deleteResource(resourceId);
    expect(deleted).toBe(true);
    expect(await getResource(resourceId)).toBeUndefined();
    expect(await deleteResource(resourceId)).toBe(false);
  });

  it("filters listResourcesPage by type and search together, matching id or name", async () => {
    const marker = randomUUID();
    const dbId = `RES-DB-${marker}`;
    await upsertResource({
      resourceId: dbId,
      resourceName: `리소스목록 DB ${marker}`,
      resourceType: "DB",
      config: { host: "h", port: 1521, database: "d", driver: "oracle", username: "u" },
    });
    await upsertResource({
      resourceId: `RES-JMS-${marker}`,
      resourceName: `리소스목록 JMS ${marker}`,
      resourceType: "JMS",
      config: { brokerUrl: "tcp://h:61616", connectionFactory: "cf", username: "u" },
    });

    const dbOnly = await listResourcesPage("DB", 1, 20, marker);
    expect(dbOnly.rows.every((r) => r.resourceType === "DB")).toBe(true);
    expect(dbOnly.rows.some((r) => r.resourceName.includes(marker))).toBe(true);

    const allTypes = await listResourcesPage(undefined, 1, 20, marker);
    expect(allTypes.total).toBeGreaterThanOrEqual(2);

    const byId = await listResourcesPage(undefined, 1, 20, dbId);
    expect(byId.rows.some((r) => r.resourceId === dbId)).toBe(true);
  });
});
