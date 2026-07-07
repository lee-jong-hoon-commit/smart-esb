import type { ConnectorConfig, ConnectorType } from "./connectorTypes.js";

export class ConfigValidationError extends Error {}

function requireString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ConfigValidationError(`${key} 값이 필요합니다.`);
  }
  return value;
}

function optionalNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const value = obj[key];
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (Number.isNaN(num)) throw new ConfigValidationError(`${key}는 숫자여야 합니다.`);
  return num;
}

// 등록/수정 화면에서 넘어온 config를 커넥터 타입에 맞게 검증하고, 불필요한 필드는 제거한
// 값을 돌려줍니다. 필수 필드가 비어있으면 ConfigValidationError를 던집니다.
export function validateConnectorConfig(connectorType: ConnectorType, rawConfig: unknown): ConnectorConfig {
  if (typeof rawConfig !== "object" || rawConfig === null) {
    throw new ConfigValidationError("config가 올바르지 않습니다.");
  }
  const config = rawConfig as Record<string, unknown>;

  switch (connectorType) {
    case "QUEUE":
      return {
        source: requireString(config, "source"),
        destination: requireString(config, "destination"),
        queueName: requireString(config, "queueName"),
      };
    case "HTTP":
      return {
        url: requireString(config, "url"),
        method: requireString(config, "method"),
        serviceIp: requireString(config, "serviceIp"),
        timeoutMs: optionalNumber(config, "timeoutMs"),
      };
    case "DB":
      return {
        table: requireString(config, "table"),
        watermarkColumn: requireString(config, "watermarkColumn"),
        pollIntervalSec: optionalNumber(config, "pollIntervalSec"),
      };
    case "FILE":
      return {
        path: requireString(config, "path"),
        pollIntervalSec: optionalNumber(config, "pollIntervalSec"),
      };
  }
}
