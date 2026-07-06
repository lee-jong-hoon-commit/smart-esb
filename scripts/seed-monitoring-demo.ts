import { randomUUID } from "node:crypto";
import type { ConnectorConfig, ConnectorType } from "../src/monitoring/connectorTypes.js";
import { upsertInterface } from "../src/monitoring/interfaceRegistry.js";
import { recordRun } from "../src/monitoring/logStore.js";
import type { RunRecord } from "../src/monitoring/types.js";

// 모니터링 화면을 Flow 실행 없이도 바로 확인할 수 있도록 더미 트랜잭션 로그를 채워 넣습니다.
// 실행: npm run seed:demo

interface InterfaceDef {
  interfaceId: string;
  interfaceName: string;
  failureRate: number; // 트랜잭션이 하나라도 실패를 포함할 확률
  connectorType: ConnectorType;
  connectorConfig: ConnectorConfig;
  makeRecord: (i: number) => unknown;
}

const ERROR_SAMPLES = [
  "HTTP 목적지 전송 실패: 500 Internal Server Error",
  "HTTP 목적지 전송 실패: 연결 시간 초과 (ETIMEDOUT)",
  "소스 조회 실패: ECONNREFUSED 127.0.0.1:1521",
  "매핑 오류: 필드 'amount'가 숫자로 변환되지 않음",
  "DB 폴링 실패: 컬럼 'status'를 찾을 수 없음",
];

const INTERFACES: InterfaceDef[] = [
  {
    interfaceId: "IF-SETTLE-001",
    interfaceName: "일 배치 정산 연계",
    failureRate: 0.08,
    connectorType: "FILE",
    connectorConfig: { path: "./data/samples/erp-settlement.json", pollIntervalSec: 86400 },
    makeRecord: (i) => ({
      settlementNo: `STL-${20260700 + i}`,
      amount: randomInt(50000, 2000000),
      branch: pick(["서울지점", "부산지점", "대구지점", "인천지점"]),
    }),
  },
  {
    interfaceId: "IF-ORDER-002",
    interfaceName: "신규 주문 연계",
    failureRate: 0.35,
    connectorType: "DB",
    connectorConfig: { table: "orders", watermarkColumn: "id", pollIntervalSec: 300 },
    makeRecord: (i) => ({
      orderNo: `ORD-${3000 + i}`,
      customer: pick(["(주)한빛물산", "대성유통", "청년마트", "미래상사"]),
      amount: randomInt(10000, 500000),
    }),
  },
  {
    interfaceId: "IF-MALL-003",
    interfaceName: "쇼핑몰 주문 실시간 연계",
    failureRate: 0.05,
    connectorType: "QUEUE",
    connectorConfig: { source: "쇼핑몰 웹훅", destination: "사내 ERP", queueName: "shopping-mall-orders" },
    makeRecord: (i) => ({
      orderId: `SM-${9000 + i}`,
      buyerName: pick(["hong gil dong", "kim minsu", "lee jieun"]),
      amount: randomInt(5000, 200000),
    }),
  },
  {
    interfaceId: "IF-LEGACY-004",
    interfaceName: "레거시 결재 파일 브릿지",
    failureRate: 0.6,
    connectorType: "HTTP",
    connectorConfig: {
      url: "http://10.20.30.41:8080/api/erp/expense",
      method: "POST",
      serviceIp: "10.20.30.41",
      timeoutMs: 800,
    },
    makeRecord: (i) => ({
      docId: `APR-${58000 + i}`,
      requester: pick(["kim.jieun", "park.minsu", "choi.yuna"]),
      amount: randomInt(20000, 800000),
    }),
  },
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

// daysAgo=0(오늘)일 때는 반드시 "오늘 자정 ~ 지금" 사이로만 떨어지도록 상한을 현재 시각으로 고정합니다.
// (예전 코드는 오늘도 최대 20시간 59분 전을 뺐는데, 현재 시각이 이보다 이르면 어제로 넘어가버려서
//  커넥터 모니터링의 "오늘 처리" 수치가 0으로 보이는 문제가 있었습니다.)
function randomTimestampWithinDay(daysAgo: number): Date {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  dayStart.setDate(dayStart.getDate() - daysAgo);

  const dayEnd = daysAgo === 0 ? new Date() : new Date(dayStart.getTime() + 86_400_000 - 1000);
  const span = Math.max(1000, dayEnd.getTime() - dayStart.getTime());
  return new Date(dayStart.getTime() + randomInt(0, span));
}

function buildRecords(iface: InterfaceDef, count: number, hasFailures: boolean): RunRecord[] {
  const failIndex = hasFailures ? randomInt(0, count - 1) : -1;
  const records: RunRecord[] = [];
  for (let i = 0; i < count; i++) {
    const isFailed = hasFailures && (i === failIndex || Math.random() < 0.3);
    records.push({
      id: randomUUID(),
      payload: iface.makeRecord(i),
      status: isFailed ? "FAILED" : "SUCCESS",
      ...(isFailed ? { error: pick(ERROR_SAMPLES) } : {}),
    });
  }
  return records;
}

async function seed() {
  let count = 0;
  const perInterfaceCounts = new Map<string, { runs: number; problems: number }>();

  for (const iface of INTERFACES) {
    await upsertInterface({
      interfaceId: iface.interfaceId,
      interfaceName: iface.interfaceName,
      connectorType: iface.connectorType,
      config: iface.connectorConfig,
    });
  }

  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    for (const iface of INTERFACES) {
      const runsToday = randomInt(4, 9);
      for (let i = 0; i < runsToday; i++) {
        const startedAt = randomTimestampWithinDay(daysAgo);
        const durationMs = randomInt(20, 900);
        const endedAt = new Date(startedAt.getTime() + durationMs);
        const recordCount = randomInt(1, 6);
        const hasFailures = Math.random() < iface.failureRate;
        const records = buildRecords(iface, recordCount, hasFailures);
        const failedCount = records.filter((r) => r.status === "FAILED").length;
        const result = failedCount === 0 ? "SUCCESS" : failedCount === records.length ? "FAILED" : "PARTIAL";
        const errorDetail = records.find((r) => r.status === "FAILED")?.error ?? null;

        await recordRun({
          transactionId: `TXN-${startedAt.getTime()}-${randomUUID().slice(0, 8)}`,
          interfaceId: iface.interfaceId,
          interfaceName: iface.interfaceName,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          recordCount,
          failedCount,
          result,
          errorDetail,
          records,
        });

        count++;
        const stats = perInterfaceCounts.get(iface.interfaceName) ?? { runs: 0, problems: 0 };
        stats.runs++;
        if (result !== "SUCCESS") stats.problems++;
        perInterfaceCounts.set(iface.interfaceName, stats);
      }
    }
  }

  console.log(
    `인터페이스 ${INTERFACES.length}개 등록(${INTERFACES.map((i) => i.connectorType).join("/")}) + 더미 트랜잭션 ${count}건을 삽입했습니다 (최근 7일).`,
  );
  for (const [name, stats] of perInterfaceCounts) {
    console.log(`  - ${name}: ${stats.runs}건 실행, 실패/부분실패 ${stats.problems}건`);
  }
}

seed();
