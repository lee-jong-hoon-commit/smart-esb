import { summarizeRange } from "./logStore.js";
import type { InterfaceErrorSummary } from "./types.js";
import { parseTimeRange } from "./timeRange.js";

export interface ChatAnswer {
  answer: string;
  range: { from: string; to: string; label: string };
  summary: InterfaceErrorSummary[];
}

function plainDigest(label: string, summary: InterfaceErrorSummary[]): string {
  if (summary.length === 0) return `${label} 동안 실행된 연계가 없습니다.`;
  const totalRuns = summary.reduce((s, f) => s + f.runs, 0);
  const totalProblems = summary.reduce((s, f) => s + f.failedRuns + f.partialRuns, 0);
  const lines = [`${label} 동안 총 ${totalRuns}건 실행, 실패/부분실패 ${totalProblems}건입니다.`];
  for (const f of summary) {
    const problems = f.failedRuns + f.partialRuns;
    if (problems === 0) continue;
    const sample = f.sampleErrors[0] ? ` (예: ${f.sampleErrors[0]})` : "";
    lines.push(`- ${f.interfaceName}: ${f.runs}건 실행 중 ${problems}건 실패/부분실패${sample}`);
  }
  if (totalProblems === 0) lines.push("실패한 연계는 없습니다.");
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
