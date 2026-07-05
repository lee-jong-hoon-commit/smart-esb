import type { Anomaly } from "../monitoring/types.js";
import { askForJson, isAiEnabled } from "./client.js";

function fallbackExplain(anomaly: Anomaly): string {
  const direction = anomaly.latestValue > anomaly.mean ? "증가" : "감소";
  const metricLabel = anomaly.metric === "errorRate" ? "에러율" : "처리 시간";
  return `${metricLabel}이(가) 평소 평균(${anomaly.mean.toFixed(2)}) 대비 ${direction}하여 ` +
    `${anomaly.latestValue.toFixed(2)}(z-score ${anomaly.zScore === Infinity ? "∞" : anomaly.zScore.toFixed(2)})를 기록했습니다.`;
}

export async function explainAnomaly(anomaly: Anomaly): Promise<string> {
  if (!isAiEnabled()) return fallbackExplain(anomaly);

  const prompt = `다음은 ESB(연계 미들웨어) 플로우에서 감지된 이상 징후입니다. 운영자가 바로 이해할 수 있도록
2~3문장의 한국어로 원인 추정과 권장 조치를 설명하세요. 반드시 JSON으로 {"explanation": "..."} 형태만 출력하세요.

이상 징후 데이터:
${JSON.stringify(anomaly, null, 2)}`;

  try {
    const result = await askForJson(prompt);
    const explanation = (result as { explanation?: string }).explanation;
    return explanation ?? fallbackExplain(anomaly);
  } catch {
    return fallbackExplain(anomaly);
  }
}
