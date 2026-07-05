import { describe, expect, it } from "vitest";
import { applyMapping, getPath, setPath } from "../src/transform/mapper.js";

describe("getPath / setPath", () => {
  it("reads nested values by dot path", () => {
    expect(getPath({ user: { name: "kim" } }, "user.name")).toBe("kim");
  });

  it("returns undefined for missing paths", () => {
    expect(getPath({ user: {} }, "user.name")).toBeUndefined();
  });

  it("writes nested values, creating intermediate objects", () => {
    const target: Record<string, unknown> = {};
    setPath(target, "customer.fullName", "kim");
    expect(target).toEqual({ customer: { fullName: "kim" } });
  });
});

describe("applyMapping", () => {
  it("maps fields and applies built-in transforms", () => {
    const source = { user: { name: "hong" }, createdAt: "2026-07-01T09:30:00Z" };
    const result = applyMapping(source, [
      { from: "user.name", to: "buyerName", transform: "uppercase" },
      { from: "createdAt", to: "orderedAt", transform: "isoDate" },
    ]);
    expect(result).toEqual({
      buyerName: "HONG",
      orderedAt: "2026-07-01T09:30:00.000Z",
    });
  });

  it("skips rules whose source value is undefined", () => {
    const result = applyMapping({}, [{ from: "missing.field", to: "target" }]);
    expect(result).toEqual({});
  });

  it("throws on unknown transform name", () => {
    expect(() => applyMapping({ a: 1 }, [{ from: "a", to: "b", transform: "nope" }])).toThrow();
  });
});
