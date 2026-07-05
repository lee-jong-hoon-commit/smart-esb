import { config } from "../config.js";
import type { FlowCreateInput } from "../core/types.js";

const echoUrl = `http://localhost:${config.port}/api/_demo/echo`;

export interface FlowTemplate {
  id: string;
  name: string;
  category: string;
  scenario: string;
  notes: string;
  definition: FlowCreateInput;
}

export const templates: FlowTemplate[] = [
  {
    id: "settlement-file-batch",
    name: "일 배치 정산 파일 연계",
    category: "파일 배치",
    scenario:
      "매일 새벽 ERP가 내려주는 정산 CSV/JSON 파일을 읽어 회계시스템이 원하는 항목명으로 변환한 뒤 결과 파일로 적재합니다. " +
      "국내 기업에서 가장 흔한 '야간 배치 파일 연계' 패턴입니다.",
    notes:
      "source 파일: data/samples/erp-settlement.json (예시 데이터 포함). 매일 01:00에 자동 실행되며, " +
      "'실행' 버튼으로 즉시 테스트할 수도 있습니다.",
    definition: {
      name: "일 배치 정산 연계",
      source: { type: "file", path: "./data/samples/erp-settlement.json" },
      destination: { type: "file", path: "./data/out/accounting-settlement.jsonl" },
      mapping: [
        { from: "settlementNo", to: "voucherNo" },
        { from: "amount", to: "amount", transform: "toNumber" },
        { from: "settleDate", to: "transactionDate" },
        { from: "branch", to: "costCenter" },
      ],
      schedule: "0 1 * * *",
    },
  },
  {
    id: "order-db-polling",
    name: "DB 폴링 기반 신규 주문 연계",
    category: "DB 폴링",
    scenario:
      "주문 테이블을 주기적으로 조회해서 신규(NEW) 상태인 주문만 물류 시스템으로 전송합니다. " +
      "레거시 Oracle/MSSQL 기반 사내 시스템과 신규 시스템을 잇는 전형적인 'DB 폴링 연계' 패턴입니다.",
    notes:
      "데모용 SQLite 'orders' 테이블에 샘플 주문 3건이 미리 들어있습니다. id 컬럼을 워터마크로 사용해 " +
      "이미 처리한 행은 다시 읽지 않습니다. destination은 데모 echo 엔드포인트이며, 실제 물류사 API URL로 교체해서 쓰세요.",
    definition: {
      name: "신규 주문 연계",
      source: {
        type: "db",
        table: "orders",
        watermarkColumn: "id",
        filter: { column: "status", equals: "NEW" },
      },
      destination: { type: "http", url: echoUrl, method: "POST" },
      mapping: [
        { from: "order_no", to: "orderNo" },
        { from: "customer", to: "customerName" },
        { from: "amount", to: "amount", transform: "toNumber" },
      ],
      schedule: "*/5 * * * *",
    },
  },
  {
    id: "shopping-mall-webhook",
    name: "REST 실시간 연계 (쇼핑몰 주문 → 사내 ERP)",
    category: "실시간 API",
    scenario:
      "쇼핑몰/커머스 플랫폼에서 주문이 발생하면 웹훅으로 실시간 수신해 사내 ERP 포맷으로 변환 후 즉시 전달합니다. " +
      "폴링 없이 이벤트가 오는 즉시 처리되는 '실시간 API 연계' 패턴입니다.",
    notes:
      "Flow 생성 후 상세보기에 표시되는 webhook URL로 아래처럼 테스트하세요:\n" +
      `curl -X POST http://localhost:${config.port}/webhook/shopping-mall-orders -H 'content-type: application/json' -d ` +
      `'{"orderId":"SM-9001","buyer":{"name":"hong gil dong"},"amount":39000}'`,
    definition: {
      name: "쇼핑몰 주문 실시간 연계",
      source: { type: "memory", queue: "shopping-mall-orders" },
      destination: { type: "http", url: echoUrl, method: "POST" },
      mapping: [
        { from: "orderId", to: "erpOrderNo" },
        { from: "buyer.name", to: "customerName", transform: "uppercase" },
        { from: "amount", to: "totalAmount", transform: "toNumber" },
      ],
    },
  },
  {
    id: "legacy-file-bridge",
    name: "레거시 파일 브릿지 연계",
    category: "파일 배치",
    scenario:
      "레거시 그룹웨어/EAI가 공유폴더에 내려주는 결재완료 export 파일을 주기적으로 스캔해서 신규 시스템 API로 전달합니다. " +
      "레거시 시스템을 직접 뜯어고치기 어려울 때 흔히 쓰는 '파일 브릿지' 연계 패턴입니다.",
    notes:
      "source 파일: data/samples/legacy-export.json. 1분마다 폴링하도록 설정되어 있어 스케줄 동작을 빠르게 확인할 수 있습니다.",
    definition: {
      name: "레거시 결재 파일 브릿지",
      source: { type: "file", path: "./data/samples/legacy-export.json" },
      destination: { type: "http", url: echoUrl, method: "POST" },
      mapping: [
        { from: "docId", to: "expenseId" },
        { from: "requester", to: "employeeId" },
        { from: "amount", to: "amount", transform: "toNumber" },
        { from: "approvedAt", to: "approvalDate", transform: "isoDate" },
        { from: "category", to: "expenseType" },
      ],
      schedule: "*/1 * * * *",
    },
  },
];

export function getTemplate(id: string): FlowTemplate | undefined {
  return templates.find((t) => t.id === id);
}
