import { MappingRuleSchema, type MappingRule } from "../core/types.js";
import { BUILTIN_TRANSFORMS } from "../transform/mapper.js";
import { askForJson, isAiEnabled } from "./client.js";

const TRANSFORM_NAMES = Object.keys(BUILTIN_TRANSFORMS).join(", ");

function buildPrompt(sourceSample: unknown, targetSample: unknown): string {
  return `당신은 ESB(연계 미들웨어)의 데이터 매핑 규칙 생성기입니다.
아래 소스 샘플 JSON을 타겟 샘플 JSON 구조로 변환하기 위한 필드 매핑 규칙을 만드세요.

소스 샘플:
${JSON.stringify(sourceSample, null, 2)}

타겟 샘플(원하는 출력 형태):
${JSON.stringify(targetSample, null, 2)}

규칙:
- 각 항목은 {"from": "소스.경로", "to": "타겟.경로", "transform": "선택"} 형태의 객체입니다.
- "from"/"to"는 점(.)으로 구분된 경로입니다 (예: user.address.city).
- 값 변환이 필요하면 transform에 다음 중 하나만 사용하세요: ${TRANSFORM_NAMES}. 필요 없으면 생략하세요.
- 타겟 샘플에 존재하는 모든 필드에 대해 최선의 매핑을 추론하세요.
- 다른 설명 없이 JSON 배열만 출력하세요.`;
}

export async function generateMapping(sourceSample: unknown, targetSample: unknown): Promise<MappingRule[]> {
  if (!isAiEnabled()) {
    throw new Error("AI 매핑 생성은 ANTHROPIC_API_KEY가 필요합니다.");
  }
  const raw = await askForJson(buildPrompt(sourceSample, targetSample));
  const rules = Array.isArray(raw) ? raw : [raw];
  return rules.map((rule) => MappingRuleSchema.parse(rule));
}
