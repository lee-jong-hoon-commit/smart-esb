import { summarizeRange } from "../monitoring/logStore.js";
import type { FlowErrorSummary } from "../monitoring/types.js";
import { parseTimeRange } from "../monitoring/timeRange.js";
import { askText } from "./client.js";

export interface ChatAnswer {
  answer: string;
  range: { from: string; to: string; label: string };
  summary: FlowErrorSummary[];
  aiUsed: boolean;
}

function plainDigest(label: string, summary: FlowErrorSummary[]): string {
  if (summary.length === 0) return `${label} 동안 실행된 연계가 없습니다.`;
  const totalRuns = summary.reduce((s, f) => s + f.runs, 0);
  const totalFailed = summary.reduce((s, f) => s + f.failed, 0);
  const lines = [`${label} 동안 총 ${totalRuns}회 실행, 실패 ${totalFailed}건입니다.`];
  for (const f of summary) {
    if (f.failed === 0) continue;
    const sample = f.sampleErrors[0] ? ` (예: ${f.sampleErrors[0]})` : "";
    lines.push(`- ${f.flowName}: ${f.runs}회 실행 중 ${f.failed}건 실패${sample}`);
  }
  if (totalFailed === 0) lines.push("실패한 연계는 없습니다.");
  return lines.join("\n");
}

// 데이터 조회는 항상 결정론적(SQL)으로, 문장 생성만 선택적으로 AI에 맡깁니다.
// Ollama가 꺼져 있으면 통계 기반 평문 요약으로 자동 폴백합니다.
export async function answerQuestion(question: string): Promise<ChatAnswer> {
  const range = parseTimeRange(question);
  const summary = await summarizeRange(range.from.toISOString(), range.to.toISOString());
  const digest = plainDigest(range.label, summary);
  const rangeOut = { from: range.from.toISOString(), to: range.to.toISOString(), label: range.label };

  try {
    const prompt = `당신은 ESB(연계 미들웨어) 운영 담당자를 돕는 챗봇입니다. 아래는 ${range.label} 동안의 연계 실행 통계입니다.
운영자의 질문에 대해 이 데이터를 근거로 한국어로 간결하게(3~5문장) 답변하세요. 데이터에 없는 내용은 추측하지 마세요.

통계 데이터(JSON):
${JSON.stringify(summary, null, 2)}

운영자 질문: "${question}"`;
    const aiAnswer = (await askText(prompt)).trim();
    return { answer: aiAnswer || digest, range: rangeOut, summary, aiUsed: Boolean(aiAnswer) };
  } catch {
    return { answer: digest, range: rangeOut, summary, aiUsed: false };
  }
}
