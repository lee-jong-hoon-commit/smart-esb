import type { ResourceConfig, ResourceType } from "./resourceTypes.js";

export class ResourceConfigValidationError extends Error {}

function requireString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ResourceConfigValidationError(`${key} 값이 필요합니다.`);
  }
  return value;
}

function requireNumber(obj: Record<string, unknown>, key: string): number {
  const value = obj[key];
  if (value === undefined || value === null || value === "") {
    throw new ResourceConfigValidationError(`${key} 값이 필요합니다.`);
  }
  const num = Number(value);
  if (Number.isNaN(num)) throw new ResourceConfigValidationError(`${key}는 숫자여야 합니다.`);
  return num;
}

// 등록/수정 화면에서 넘어온 config를 리소스 타입에 맞게 검증하고, 불필요한 필드는 제거한
// 값을 돌려줍니다. 비밀번호 등 시크릿은 이 화면에서 다루지 않고 별도 시크릿 저장소를
// 참조한다고 가정합니다 (평문 저장을 피하기 위함).
export function validateResourceConfig(resourceType: ResourceType, rawConfig: unknown): ResourceConfig {
  if (typeof rawConfig !== "object" || rawConfig === null) {
    throw new ResourceConfigValidationError("config가 올바르지 않습니다.");
  }
  const config = rawConfig as Record<string, unknown>;

  switch (resourceType) {
    case "DB":
      return {
        host: requireString(config, "host"),
        port: requireNumber(config, "port"),
        database: requireString(config, "database"),
        driver: requireString(config, "driver"),
        username: requireString(config, "username"),
      };
    case "JMS":
      return {
        brokerUrl: requireString(config, "brokerUrl"),
        connectionFactory: requireString(config, "connectionFactory"),
        username: requireString(config, "username"),
      };
  }
}
