import { randomUUID } from "node:crypto";
import type { ConnectorConfig, ConnectorType } from "../src/monitoring/connectorTypes.js";
import { upsertInterface } from "../src/monitoring/interfaceRegistry.js";
import { recordRun } from "../src/monitoring/logStore.js";
import { recordHeartbeat } from "../src/monitoring/nodeMonitoring.js";
import { upsertNode } from "../src/monitoring/nodeRegistry.js";
import type { NodeConfig, NodeStatus, NodeType } from "../src/monitoring/nodeTypes.js";
import { upsertResource } from "../src/monitoring/resourceRegistry.js";
import type { ResourceConfig, ResourceType } from "../src/monitoring/resourceTypes.js";
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

interface ResourceDef {
  resourceId: string;
  resourceName: string;
  resourceType: ResourceType;
  config: ResourceConfig;
}

const RESOURCES: ResourceDef[] = [
  {
    resourceId: "RES-DB-ERP",
    resourceName: "ERP 운영 DB",
    resourceType: "DB",
    config: { host: "10.10.20.11", port: 1521, database: "ERPDB", driver: "oracle", username: "esb_reader" },
  },
  {
    resourceId: "RES-DB-ORDERS",
    resourceName: "주문 시스템 DB",
    resourceType: "DB",
    config: { host: "10.10.20.30", port: 3306, database: "orders", driver: "mysql", username: "esb_reader" },
  },
  {
    resourceId: "RES-JMS-MALL",
    resourceName: "쇼핑몰 큐 브로커",
    resourceType: "JMS",
    config: { brokerUrl: "tcp://10.10.30.5:61616", connectionFactory: "ConnectionFactory", username: "esb_mq" },
  },
];

interface NodeDef {
  nodeId: string;
  nodeName: string;
  nodeType: NodeType;
  host: string;
  config: NodeConfig;
  profile: "정상" | "경고" | "장애"; // 하트비트 더미 데이터를 이 상태에 맞는 자원 사용률 범위로 생성
}

const NODES: NodeDef[] = [
  {
    nodeId: "ESB-01",
    nodeName: "ESB 엔진 #1 (서울)",
    nodeType: "ESB",
    host: "10.30.1.11",
    config: { port: 8080, version: "3.2.1" },
    profile: "정상",
  },
  {
    nodeId: "ESB-02",
    nodeName: "ESB 엔진 #2 (부산, 대기)",
    nodeType: "ESB",
    host: "10.30.1.12",
    config: { port: 8080, version: "3.2.1" },
    profile: "정상",
  },
  {
    nodeId: "AGENT-ERP",
    nodeName: "ERP 연계 에이전트",
    nodeType: "AGENT",
    host: "10.30.2.21",
    config: { targetSystem: "ERP", version: "1.4.0" },
    profile: "정상",
  },
  {
    nodeId: "AGENT-MALL",
    nodeName: "쇼핑몰 연계 에이전트",
    nodeType: "AGENT",
    host: "10.30.2.22",
    config: { targetSystem: "쇼핑몰", version: "1.4.0" },
    profile: "장애",
  },
  {
    nodeId: "ADAPTER-DB",
    nodeName: "DB 어댑터",
    nodeType: "ADAPTER",
    host: "10.30.3.31",
    config: { adapterKind: "DB_ADAPTER", version: "2.0.3" },
    profile: "경고",
  },
  {
    nodeId: "ADAPTER-FILE",
    nodeName: "FILE 어댑터",
    nodeType: "ADAPTER",
    host: "10.30.3.32",
    config: { adapterKind: "FILE_ADAPTER", version: "2.0.3" },
    profile: "정상",
  },
];

const RESOURCE_RANGE: Record<"정상" | "경고" | "장애", { cpu: [number, number]; mem: [number, number]; disk: [number, number] }> = {
  정상: { cpu: [15, 45], mem: [30, 60], disk: [40, 70] },
  경고: { cpu: [70, 88], mem: [65, 85], disk: [75, 90] },
  장애: { cpu: [90, 99], mem: [90, 99], disk: [85, 97] },
};

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

  for (const resource of RESOURCES) {
    await upsertResource(resource);
  }

  let heartbeatCount = 0;
  const HEARTBEAT_POINTS = 24; // 최근 2시간, 5분 간격
  for (const node of NODES) {
    await upsertNode({
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      nodeType: node.nodeType,
      host: node.host,
      config: node.config,
    });
    const range = RESOURCE_RANGE[node.profile];
    for (let i = HEARTBEAT_POINTS - 1; i >= 0; i--) {
      await recordHeartbeat({
        nodeId: node.nodeId,
        reportedAt: new Date(Date.now() - i * 5 * 60_000).toISOString(),
        status: node.profile,
        cpuPct: randomInt(range.cpu[0], range.cpu[1]),
        memPct: randomInt(range.mem[0], range.mem[1]),
        diskPct: randomInt(range.disk[0], range.disk[1]),
        uptimeSec: randomInt(3600, 2_000_000),
      });
      heartbeatCount++;
    }
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
  console.log(`공통 리소스 ${RESOURCES.length}개 등록(${RESOURCES.map((r) => r.resourceType).join("/")}).`);
  console.log(
    `노드 ${NODES.length}개 등록(${NODES.map((n) => `${n.nodeId}:${n.profile}`).join(", ")}) + 하트비트 ${heartbeatCount}건을 삽입했습니다.`,
  );
  for (const [name, stats] of perInterfaceCounts) {
    console.log(`  - ${name}: ${stats.runs}건 실행, 실패/부분실패 ${stats.problems}건`);
  }
}

seed();
