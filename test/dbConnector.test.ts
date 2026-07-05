import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

let createDbSource: (typeof import("../src/connectors/db.js"))["createDbSource"];
let db: (typeof import("../src/db/index.js"))["db"];

beforeAll(async () => {
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "smart-esb-test-"));
  const dbConnector = await import("../src/connectors/db.js");
  const dbModule = await import("../src/db/index.js");
  createDbSource = dbConnector.createDbSource;
  db = dbModule.db;
});

describe("db polling connector", () => {
  it("returns the seeded demo orders on the first poll", async () => {
    const flowId = randomUUID();
    const source = createDbSource(flowId, "orders", "id", { column: "status", equals: "NEW" });
    const messages = await source.receive();
    expect(messages.length).toBe(3);
    expect((messages[0].payload as { order_no: string }).order_no).toBe("ORD-2001");
  });

  it("does not re-return already-seen rows on the next poll", async () => {
    const flowId = randomUUID();
    const source = createDbSource(flowId, "orders", "id", { column: "status", equals: "NEW" });
    await source.receive();
    const second = await source.receive();
    expect(second).toEqual([]);
  });

  it("picks up newly inserted rows after the watermark advances", async () => {
    const flowId = randomUUID();
    const source = createDbSource(flowId, "orders", "id", { column: "status", equals: "NEW" });
    await source.receive();

    db.prepare(
      "INSERT INTO orders (order_no, customer, amount, status, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("ORD-9999", "신규거래처", 99000, "NEW", new Date().toISOString());

    const messages = await source.receive();
    expect(messages).toHaveLength(1);
    expect((messages[0].payload as { order_no: string }).order_no).toBe("ORD-9999");
  });

  it("keeps separate watermarks per flow", async () => {
    const flowA = randomUUID();
    const flowB = randomUUID();
    const sourceA = createDbSource(flowA, "orders", "id", { column: "status", equals: "NEW" });
    const sourceB = createDbSource(flowB, "orders", "id", { column: "status", equals: "NEW" });

    const first = await sourceA.receive();
    expect(first.length).toBeGreaterThan(0);
    const stillAllForB = await sourceB.receive();
    expect(stillAllForB.length).toBe(first.length);
  });
});
