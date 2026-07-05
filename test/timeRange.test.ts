import { describe, expect, it } from "vitest";
import { parseTimeRange } from "../src/monitoring/timeRange.js";

const NOW = new Date("2026-07-05T15:30:00");

describe("parseTimeRange", () => {
  it("recognizes 오늘/금일 as start-of-day to now", () => {
    const range = parseTimeRange("금일 연계 에러 현황 정리해줘", NOW);
    expect(range.label).toBe("오늘");
    expect(range.from.toDateString()).toBe(NOW.toDateString());
    expect(range.from.getHours()).toBe(0);
    expect(range.to).toEqual(NOW);
  });

  it("recognizes 어제 as the full previous day", () => {
    const range = parseTimeRange("어제 실패한 연계 있어?", NOW);
    expect(range.label).toBe("어제");
    const dayMs = 86_400_000;
    expect(range.to.getTime() - range.from.getTime()).toBe(dayMs);
  });

  it("recognizes '최근 N시간'", () => {
    const range = parseTimeRange("최근 3시간 상황 알려줘", NOW);
    expect(range.label).toBe("최근 3시간");
    expect(NOW.getTime() - range.from.getTime()).toBe(3 * 3600_000);
  });

  it("recognizes '지난 N일'", () => {
    const range = parseTimeRange("지난 7일 통계 보여줘", NOW);
    expect(range.label).toBe("최근 7일");
    expect(NOW.getTime() - range.from.getTime()).toBe(7 * 86_400_000);
  });

  it("falls back to the last 24 hours when nothing matches", () => {
    const range = parseTimeRange("아무 힌트도 없는 질문", NOW);
    expect(range.label).toContain("24시간");
    expect(NOW.getTime() - range.from.getTime()).toBe(24 * 3600_000);
  });
});
