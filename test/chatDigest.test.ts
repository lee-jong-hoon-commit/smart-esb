import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

let recordRun: (typeof import("../src/monitoring/logStore.js"))["recordRun"];
let answerQuestion: (typeof import("../src/monitoring/chatDigest.js"))["answerQuestion"];

beforeAll(async () => {
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "smart-esb-test-"));
  const logStore = await import("../src/monitoring/logStore.js");
  const chatDigest = await import("../src/monitoring/chatDigest.js");
  recordRun = logStore.recordRun;
  answerQuestion = chatDigest.answerQuestion;
});

describe("answerQuestion (AI 없이 평문 요약)", () => {
  it("reports no runs when nothing happened in range", async () => {
    const result = await answerQuestion("최근 1시간 상황 알려줘");
    expect(result.answer).toContain("실행된 연계가 없습니다");
    expect(result.range.label).toBe("최근 1시간");
  });

  it("summarizes success-only runs without listing any failures", async () => {
    await recordRun({
      flowId: randomUUID(),
      flowName: "정상 연계",
      timestamp: new Date().toISOString(),
      durationMs: 5,
      received: 2,
      success: 2,
      failed: 0,
      errors: [],
    });
    const result = await answerQuestion("최근 1시간 상황 알려줘");
    expect(result.answer).toContain("실패 0건");
    expect(result.answer).not.toContain("정상 연계:");
  });

  it("names the failing flow and a sample error message", async () => {
    await recordRun({
      flowId: randomUUID(),
      flowName: "고장난 연계",
      timestamp: new Date().toISOString(),
      durationMs: 5,
      received: 2,
      success: 0,
      failed: 2,
      errors: ["HTTP 목적지 전송 실패: 500 Internal Server Error"],
    });
    const result = await answerQuestion("최근 1시간 상황 알려줘");
    expect(result.answer).toContain("고장난 연계");
    expect(result.answer).toContain("HTTP 목적지 전송 실패: 500 Internal Server Error");
  });
});
