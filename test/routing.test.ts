import { describe, expect, it } from "vitest";
import { matchesRouting } from "../src/transform/routing.js";

describe("matchesRouting", () => {
  it("supports numeric comparisons", () => {
    const payload = { stock: { count: 42 } };
    expect(matchesRouting(payload, { field: "stock.count", operator: "lt", value: 100 })).toBe(true);
    expect(matchesRouting(payload, { field: "stock.count", operator: "gt", value: 100 })).toBe(false);
    expect(matchesRouting(payload, { field: "stock.count", operator: "gte", value: 42 })).toBe(true);
    expect(matchesRouting(payload, { field: "stock.count", operator: "lte", value: 41 })).toBe(false);
  });

  it("supports equality and inequality", () => {
    const payload = { status: "OPEN" };
    expect(matchesRouting(payload, { field: "status", operator: "eq", value: "OPEN" })).toBe(true);
    expect(matchesRouting(payload, { field: "status", operator: "neq", value: "OPEN" })).toBe(false);
  });

  it("supports string contains", () => {
    const payload = { message: "inventory low" };
    expect(matchesRouting(payload, { field: "message", operator: "contains", value: "low" })).toBe(true);
    expect(matchesRouting(payload, { field: "message", operator: "contains", value: "high" })).toBe(false);
  });

  it("returns false for non-numeric comparisons instead of throwing", () => {
    const payload = { status: "OPEN" };
    expect(matchesRouting(payload, { field: "status", operator: "gt", value: 1 })).toBe(false);
  });

  it("returns false when the field is missing", () => {
    expect(matchesRouting({}, { field: "missing.path", operator: "eq", value: "x" })).toBe(false);
  });
});
