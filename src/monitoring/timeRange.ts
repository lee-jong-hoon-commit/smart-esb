export interface TimeRange {
  from: Date;
  to: Date;
  label: string;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfWeek(d: Date): Date {
  const copy = startOfDay(d);
  const day = copy.getDay(); // 0=일요일
  const diffToMonday = day === 0 ? 6 : day - 1;
  copy.setDate(copy.getDate() - diffToMonday);
  return copy;
}

// 질문 문장에서 시간 범위를 결정론적으로 추출합니다 (AI에 맡기지 않음 — 데이터 조회는 항상 정확해야 하므로).
export function parseTimeRange(question: string, now = new Date()): TimeRange {
  const hoursMatch = question.match(/(?:최근|지난)\s*(\d+)\s*시간/);
  if (hoursMatch) {
    const hours = Number(hoursMatch[1]);
    return { from: new Date(now.getTime() - hours * 3600_000), to: now, label: `최근 ${hours}시간` };
  }

  const daysMatch = question.match(/(?:최근|지난)\s*(\d+)\s*일/);
  if (daysMatch) {
    const days = Number(daysMatch[1]);
    return { from: new Date(now.getTime() - days * 86_400_000), to: now, label: `최근 ${days}일` };
  }

  if (/어제/.test(question)) {
    const startToday = startOfDay(now);
    const startYesterday = new Date(startToday.getTime() - 86_400_000);
    return { from: startYesterday, to: startToday, label: "어제" };
  }

  if (/오늘|금일/.test(question)) {
    return { from: startOfDay(now), to: now, label: "오늘" };
  }

  if (/이번\s*주|금주/.test(question)) {
    return { from: startOfWeek(now), to: now, label: "이번 주" };
  }

  return { from: new Date(now.getTime() - 24 * 3600_000), to: now, label: "최근 24시간(기본값)" };
}
