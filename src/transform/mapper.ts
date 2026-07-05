import type { MappingRule } from "../core/types.js";

type TransformFn = (value: unknown) => unknown;

export const BUILTIN_TRANSFORMS: Record<string, TransformFn> = {
  uppercase: (v) => String(v).toUpperCase(),
  lowercase: (v) => String(v).toLowerCase(),
  trim: (v) => String(v).trim(),
  toNumber: (v) => Number(v),
  toString: (v: unknown) => String(v),
  toBoolean: (v) => v === true || v === "true" || v === 1 || v === "1",
  isoDate: (v) => new Date(v as string).toISOString(),
};

export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

export function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let cursor = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (typeof cursor[key] !== "object" || cursor[key] === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
}

export function applyMapping(payload: unknown, rules: MappingRule[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const rule of rules) {
    let value = getPath(payload, rule.from);
    if (value === undefined) continue;
    if (rule.transform) {
      const fn = BUILTIN_TRANSFORMS[rule.transform];
      if (!fn) throw new Error(`알 수 없는 변환 함수: ${rule.transform}`);
      value = fn(value);
    }
    setPath(result, rule.to, value);
  }
  return result;
}
