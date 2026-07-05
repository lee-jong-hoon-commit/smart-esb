import type { RoutingCondition } from "../core/types.js";
import { getPath } from "./mapper.js";

export function matchesRouting(payload: unknown, condition: RoutingCondition): boolean {
  const actual = getPath(payload, condition.field);
  const expected = condition.value;

  switch (condition.operator) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "contains":
      return typeof actual === "string" && typeof expected === "string" && actual.includes(expected);
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const a = Number(actual);
      const b = Number(expected);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      if (condition.operator === "gt") return a > b;
      if (condition.operator === "gte") return a >= b;
      if (condition.operator === "lt") return a < b;
      return a <= b;
    }
  }
}
