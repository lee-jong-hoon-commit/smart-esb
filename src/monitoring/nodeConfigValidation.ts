import type { NodeConfig, NodeType } from "./nodeTypes.js";

export class NodeConfigValidationError extends Error {}

function requireString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new NodeConfigValidationError(`${key} 값이 필요합니다.`);
  }
  return value;
}

function requireNumber(obj: Record<string, unknown>, key: string): number {
  const value = obj[key];
  if (value === undefined || value === null || value === "") {
    throw new NodeConfigValidationError(`${key} 값이 필요합니다.`);
  }
  const num = Number(value);
  if (Number.isNaN(num)) throw new NodeConfigValidationError(`${key}는 숫자여야 합니다.`);
  return num;
}

// 등록/수정 화면에서 넘어온 config를 노드 타입에 맞게 검증하고, 불필요한 필드는 제거한
// 값을 돌려줍니다.
export function validateNodeConfig(nodeType: NodeType, rawConfig: unknown): NodeConfig {
  if (typeof rawConfig !== "object" || rawConfig === null) {
    throw new NodeConfigValidationError("config가 올바르지 않습니다.");
  }
  const config = rawConfig as Record<string, unknown>;

  switch (nodeType) {
    case "ESB":
      return {
        port: requireNumber(config, "port"),
        version: requireString(config, "version"),
      };
    case "AGENT":
      return {
        targetSystem: requireString(config, "targetSystem"),
        version: requireString(config, "version"),
      };
    case "ADAPTER":
      return {
        adapterKind: requireString(config, "adapterKind"),
        version: requireString(config, "version"),
      };
  }
}
