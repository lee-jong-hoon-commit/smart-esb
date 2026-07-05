# smart-esb

AI 기술이 접목된 범용 연계(ESB) 솔루션. 특정 도메인에 종속되지 않고, 커넥터 설정만으로
서로 다른 시스템 사이에 데이터를 연결(Flow)할 수 있습니다.

## 핵심 개념

- **Flow**: 소스 커넥터 → (매핑/변환) → 목적지 커넥터로 구성된 연계 단위
- **Connector**: `file` / `http` / `memory` 타입을 지원하는 입출력 어댑터 (신규 타입 추가 가능)
- **AI 매핑 생성**: 소스/타겟 샘플 JSON만 주면 Claude가 필드 매핑 규칙(JSON)을 생성 →
  런타임에는 저장된 규칙을 결정적으로(빠르게) 적용
- **이상탐지**: 각 Flow 실행마다 처리시간·에러율을 기록하고, 과거 평균 대비 z-score로
  이상치를 탐지 → 필요 시 AI가 자연어로 원인/조치를 설명

## 빠른 시작

```bash
npm install
cp .env.example .env   # ANTHROPIC_API_KEY 입력 시 AI 매핑 생성/이상탐지 설명 활성화
npm run dev            # http://localhost:4000
```

AI 관련 API는 `ANTHROPIC_API_KEY` 없이도 나머지 기능(Flow 실행, 매핑 적용, 이상탐지 탐지)이
정상 동작합니다. 이상탐지 설명(`explain=true`)만 규칙 기반 문구로 폴백됩니다.

## API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/flows` | Flow 목록 |
| POST | `/api/flows` | Flow 생성 |
| GET | `/api/flows/:id` | Flow 조회 |
| DELETE | `/api/flows/:id` | Flow 삭제 |
| POST | `/api/flows/:id/run` | Flow 실행 (소스 수신 → 매핑 → 목적지 전송) |
| POST | `/api/mapping/generate` | 소스/타겟 샘플로 AI 매핑 규칙 생성 |
| GET | `/api/metrics/:flowId` | Flow 실행 이력 |
| GET | `/api/metrics/:flowId/anomalies?explain=true` | 특정 Flow 이상탐지 (설명 포함 옵션) |
| GET | `/api/anomalies` | 전체 Flow 중 이상탐지된 항목만 |

## 예시: AI로 매핑 생성 → Flow 등록 → 실행

```bash
# 1) 샘플로 매핑 규칙 생성 (data/samples/ 예시 사용)
curl -X POST http://localhost:4000/api/mapping/generate \
  -H 'content-type: application/json' \
  -d "{\"sourceSample\": $(cat data/samples/source-order.json), \"targetSample\": $(cat data/samples/target-order.json)}"

# 2) 생성된 mapping 배열을 그대로 Flow에 붙여 등록
curl -X POST http://localhost:4000/api/flows \
  -H 'content-type: application/json' \
  -d '{
    "name": "order-sync",
    "source": { "type": "file", "path": "./data/samples/source-order.json" },
    "destination": { "type": "file", "path": "./data/out/orders.jsonl" },
    "mapping": [ ... ]
  }'

# 3) 실행
curl -X POST http://localhost:4000/api/flows/<id>/run
```

## 매핑 규칙 형식

```json
{ "from": "user.name", "to": "customer.fullName", "transform": "uppercase" }
```

지원 `transform`: `uppercase`, `lowercase`, `trim`, `toNumber`, `toString`, `toBoolean`, `isoDate`

## 커넥터 설정

```json
{ "type": "file", "path": "./data/in.json" }
{ "type": "memory", "queue": "queue-name" }
{ "type": "http", "url": "https://example.com/api", "method": "POST" }
```

## 개발

```bash
npm run test    # vitest
npm run build   # tsc → dist/
npm start       # dist/index.js 실행
```
