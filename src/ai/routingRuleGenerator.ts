import { RoutingConditionSchema, RoutingOperatorSchema, type RoutingCondition } from "../core/types.js";
import { askForJson } from "./client.js";

const OPERATORS = RoutingOperatorSchema.options.join(", ");

function buildPrompt(sample: unknown, description: string): string {
  return `당신은 ESB(연계 미들웨어)의 라우팅 규칙 생성기입니다.
운영자가 자연어로 설명한 조건을, 아래 샘플 페이로드 구조를 기준으로 구조화된 조건 하나로 변환하세요.

샘플 페이로드:
${JSON.stringify(sample, null, 2)}

자연어 조건:
"${description}"

규칙:
- 정확히 하나의 JSON 객체만 출력하세요: {"field": "경로", "operator": "...", "value": ..., "description": "..."}
- "field"는 점(.)으로 구분된 샘플 페이로드의 경로여야 합니다 (예: stock.count).
- "operator"는 다음 중 하나만 사용하세요: ${OPERATORS}.
- "value"는 조건과 비교할 값입니다 (숫자/문자열/불리언).
- "description"에는 입력받은 자연어 조건을 그대로 담으세요.
- 다른 설명 없이 JSON 객체만 출력하세요.`;
}

export async function generateRoutingCondition(sample: unknown, description: string): Promise<RoutingCondition> {
  const raw = await askForJson(buildPrompt(sample, description));
  return RoutingConditionSchema.parse({ ...(raw as object), description });
}
