import { summarizeRange } from "./logStore.js";
import type { FlowErrorSummary } from "./types.js";
import { parseTimeRange } from "./timeRange.js";

export interface ChatAnswer {
  answer: string;
  range: { from: string; to: string; label: string };
  summary: FlowErrorSummary[];
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

// 질문에서 기간을 결정론적으로(정규식) 뽑고, 실제 실행 로그를 SQL로 집계해 평문으로 요약합니다.
// AI를 전혀 쓰지 않으므로 항상 동일하게 동작합니다.
export async function answerQuestion(question: string): Promise<ChatAnswer> {
  const range = parseTimeRange(question);
  const summary = await summarizeRange(range.from.toISOString(), range.to.toISOString());
  const rangeOut = { from: range.from.toISOString(), to: range.to.toISOString(), label: range.label };
  return { answer: plainDigest(range.label, summary), range: rangeOut, summary };
}
