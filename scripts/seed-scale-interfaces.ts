import { randomUUID } from "node:crypto";
import { db } from "../src/db/index.js";
import type { ConnectorType } from "../src/monitoring/connectorTypes.js";

// 인터페이스가 수천 개로 늘어나는 상황을 실제로 재현해서 /api/stats/by-interface의
// 검색+페이지네이션이 실제로 버티는지 확인하기 위한 스트레스 테스트용 시드입니다.
// 실행: npm run seed:scale (기본 3000개, 인자로 개수 지정 가능: npm run seed:scale -- 10000)

const COUNT = Number(process.argv[2] ?? 3000);
const CONNECTOR_TYPES: ConnectorType[] = ["QUEUE", "HTTP", "DB", "FILE"];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seedScale() {
  const insertRun = db.prepare(
    `INSERT INTO interface_runs
      (transaction_id, interface_id, interface_name, started_at, ended_at, duration_ms, record_count, failed_count, result, error_detail, records_json)
     VALUES (@transactionId, @interfaceId, @interfaceName, @startedAt, @endedAt, @durationMs, @recordCount, @failedCount, @result, @errorDetail, NULL)`,
  );

  const insertAll = db.transaction((n: number) => {
    for (let i = 1; i <= n; i++) {
      const interfaceId = `IF-SCALE-${String(i).padStart(6, "0")}`;
      const interfaceName = `대량 테스트 인터페이스 ${String(i).padStart(6, "0")}`;
      const connectorType = CONNECTOR_TYPES[i % CONNECTOR_TYPES.length];

      db.prepare(
        `INSERT INTO interfaces (interface_id, interface_name, connector_type, config_json, created_at)
         VALUES (@interfaceId, @interfaceName, @connectorType, @configJson, @createdAt)
         ON CONFLICT(interface_id) DO UPDATE SET
           interface_name = excluded.interface_name, connector_type = excluded.connector_type`,
      ).run({
        interfaceId,
        interfaceName,
        connectorType,
        configJson: JSON.stringify({ note: "stress-test" }),
        createdAt: new Date().toISOString(),
      });

      const runs = randomInt(1, 3);
      for (let r = 0; r < runs; r++) {
        const startedAt = new Date(Date.now() - randomInt(0, 29) * 86_400_000 - randomInt(0, 86_399) * 1000);
        const recordCount = randomInt(1, 5);
        const failedCount = Math.random() < 0.1 ? randomInt(1, recordCount) : 0;
        insertRun.run({
          transactionId: `TXN-SCALE-${randomUUID()}`,
          interfaceId,
          interfaceName,
          startedAt: startedAt.toISOString(),
          endedAt: new Date(startedAt.getTime() + randomInt(10, 400)).toISOString(),
          durationMs: randomInt(10, 400),
          recordCount,
          failedCount,
          result: failedCount === 0 ? "SUCCESS" : failedCount === recordCount ? "FAILED" : "PARTIAL",
          errorDetail: failedCount > 0 ? "대량 테스트용 더미 에러" : null,
        });
      }
    }
  });

  insertAll(COUNT);
  console.log(`대량 테스트용 인터페이스 ${COUNT}개 + 트랜잭션을 삽입했습니다.`);
}

seedScale();
