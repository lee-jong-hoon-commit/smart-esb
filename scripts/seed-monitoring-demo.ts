import { randomUUID } from "node:crypto";
import { recordRun } from "../src/monitoring/logStore.js";

// 모니터링 화면을 Flow/템플릿 없이도 바로 확인할 수 있도록 더미 실행 로그를 채워 넣습니다.
// 실행: npm run seed:demo

const FLOWS = [
  { id: randomUUID(), name: "일 배치 정산 연계" },
  { id: randomUUID(), name: "신규 주문 연계" },
  { id: randomUUID(), name: "쇼핑몰 주문 실시간 연계" },
  { id: randomUUID(), name: "레거시 결재 파일 브릿지" },
];

const ERROR_SAMPLES = [
  "HTTP 목적지 전송 실패: 500 Internal Server Error",
  "HTTP 목적지 전송 실패: 연결 시간 초과 (ETIMEDOUT)",
  "소스 조회 실패: ECONNREFUSED 127.0.0.1:1521",
  "매핑 오류: 필드 'amount'가 숫자로 변환되지 않음",
  "DB 폴링 실패: 컬럼 'status'를 찾을 수 없음",
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

async function seed() {
  const now = Date.now();
  const runsToInsert: Parameters<typeof recordRun>[0][] = [];

  // 지난 3일 * 하루 6~10회 실행, flow마다 다른 실패율로 현실감 있게 생성
  const failureRateByFlow = new Map(FLOWS.map((f, i) => [f.id, [0.05, 0.35, 0.1, 0.6][i]]));

  for (let daysAgo = 2; daysAgo >= 0; daysAgo--) {
    for (const flow of FLOWS) {
      const runsToday = randomInt(4, 9);
      for (let i = 0; i < runsToday; i++) {
        const timestamp = new Date(now - daysAgo * 86_400_000 - randomInt(0, 20) * 3600_000 - randomInt(0, 59) * 60_000);
        const received = randomInt(1, 5);
        const failureRate = failureRateByFlow.get(flow.id) ?? 0.1;
        const isFailure = Math.random() < failureRate;
        const failed = isFailure ? randomInt(1, received) : 0;
        const success = received - failed;
        const errors = isFailure ? [pick(ERROR_SAMPLES)] : [];

        runsToInsert.push({
          flowId: flow.id,
          flowName: flow.name,
          timestamp: timestamp.toISOString(),
          durationMs: randomInt(3, 400),
          received,
          success,
          failed,
          errors,
        });
      }
    }
  }

  // 타임스탬프 오름차순으로 정렬 후 삽입 (모니터링 화면에서 최신순 정렬이 자연스럽게 보이도록)
  runsToInsert.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (const run of runsToInsert) {
    await recordRun(run);
  }

  console.log(`더미 실행 로그 ${runsToInsert.length}건을 삽입했습니다 (Flow ${FLOWS.length}개, 최근 3일).`);
  for (const flow of FLOWS) {
    const flowRuns = runsToInsert.filter((r) => r.flowId === flow.id);
    const failedCount = flowRuns.reduce((sum, r) => sum + r.failed, 0);
    console.log(`  - ${flow.name}: ${flowRuns.length}회 실행, 실패 ${failedCount}건`);
  }
}

seed();
