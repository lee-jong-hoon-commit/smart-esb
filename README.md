# smart-esb

AI 기술이 접목된 범용 연계(ESB) 솔루션. 특정 도메인에 종속되지 않고, 커넥터 설정만으로
서로 다른 시스템 사이에 데이터를 연결(Flow)할 수 있습니다.

## 핵심 개념

- **Flow**: 소스 커넥터 → (라우팅 필터) → (매핑/변환) → 목적지 커넥터로 구성된 연계 단위
- **Connector**: `file` / `http` / `memory` 타입을 지원하는 입출력 어댑터 (신규 타입 추가 가능)
- **웹훅 실시간 수신**: source가 `memory` 타입인 Flow는 `POST /webhook/:queue`로 들어오는
  요청을 폴링 없이 즉시 처리(매핑 → 목적지 전송 → 지표 기록)합니다.
- **AI 매핑 생성**: 소스/타겟 샘플 JSON만 주면 로컬 Ollama가 필드 매핑 규칙(JSON)을 생성 →
  런타임에는 저장된 규칙을 결정적으로(빠르게) 적용
- **자연어 라우팅 규칙**: "재고가 100개 미만이면 보내라" 같은 자연어를 Ollama가
  `{field, operator, value}` 조건으로 변환 → 조건에 맞는 메시지만 목적지로 전달, 나머지는 필터링
- **이상탐지**: 각 Flow 실행마다 처리시간·에러율을 기록(SQLite)하고, 과거 평균 대비 z-score로
  이상치를 탐지 → 필요 시 AI가 자연어로 원인/조치를 설명
- **웹 대시보드**: Flow 생성/실행/삭제, 매핑·라우팅 생성, 실행 이력·이상탐지를
  브라우저에서 바로 조작 (`http://localhost:4000`)
- **영속화**: 모든 Flow 정의와 실행 이력은 SQLite(`better-sqlite3`, `data/smart-esb.sqlite`)에 저장

AI 엔진은 **Ollama(로컬·무료)** 만 사용합니다. 별도 API 키나 과금이 필요 없습니다.

## 빠른 시작

```bash
# 1) Ollama 설치(https://ollama.com) 후 모델 받기 (한 번만, AI 기능에만 필요)
ollama pull qwen2.5

# 2) 설치 및 실행
npm install
cp .env.example .env   # 기본값 그대로 사용 가능 (OLLAMA_HOST/OLLAMA_MODEL)
npm run dev            # http://localhost:4000 (대시보드 UI + API)
```

Ollama가 꺼져 있어도 AI 이외의 기능(Flow 생성/실행, 웹훅 수신, 매핑/라우팅 적용, 이상탐지
탐지 자체, 대시보드)은 정상 동작합니다.
- `/api/mapping/generate`, `/api/routing/generate`는 Ollama가 꺼져 있으면 에러를 반환합니다.
- 이상탐지 설명(`explain=true`)은 Ollama가 꺼져 있으면 규칙 기반 문구로 자동 폴백합니다.
- `GET /health`에서 `ollamaReachable`로 현재 Ollama 연결 상태를 확인할 수 있습니다.
- 대시보드 상단 배지에도 동일한 상태가 표시됩니다.

## API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/flows` | Flow 목록 |
| POST | `/api/flows` | Flow 생성 |
| GET | `/api/flows/:id` | Flow 조회 |
| DELETE | `/api/flows/:id` | Flow 삭제 |
| POST | `/api/flows/:id/run` | Flow 실행 (소스 수신 → 라우팅 → 매핑 → 목적지 전송) |
| POST | `/webhook/:queue` | 웹훅 실시간 수신: 해당 큐를 source로 쓰는 모든 Flow를 즉시 실행 |
| POST | `/api/mapping/generate` | 소스/타겟 샘플로 AI 매핑 규칙 생성 |
| POST | `/api/routing/generate` | 샘플 + 자연어 설명으로 AI 라우팅 규칙 생성 |
| POST | `/api/routing/preview` | 샘플이 특정 라우팅 규칙을 통과하는지 미리보기 |
| GET | `/api/metrics/:flowId` | Flow 실행 이력 |
| GET | `/api/metrics/:flowId/anomalies?explain=true` | 특정 Flow 이상탐지 (설명 포함 옵션) |
| GET | `/api/anomalies` | 전체 Flow 중 이상탐지된 항목만 |

## 예시: AI로 매핑/라우팅 생성 → Flow 등록 → 웹훅으로 실시간 실행

```bash
# 1) 샘플로 매핑 규칙 생성 (data/samples/ 예시 사용)
curl -X POST http://localhost:4000/api/mapping/generate \
  -H 'content-type: application/json' \
  -d "{\"sourceSample\": $(cat data/samples/source-order.json), \"targetSample\": $(cat data/samples/target-order.json)}"

# 2) 생성된 mapping 배열을 그대로 Flow에 붙여 등록 (source를 memory로 하면 웹훅으로 실시간 수신)
curl -X POST http://localhost:4000/api/flows \
  -H 'content-type: application/json' \
  -d '{
    "name": "order-sync",
    "source": { "type": "memory", "queue": "orders" },
    "destination": { "type": "file", "path": "./data/out/orders.jsonl" },
    "mapping": [ ... ],
    "routing": { "field": "stock.count", "operator": "lt", "value": 100 }
  }'

# 3) 웹훅으로 실시간 전송 (폴링 없이 즉시 처리됨)
curl -X POST http://localhost:4000/webhook/orders \
  -H 'content-type: application/json' \
  -d '{ "orderId": "ORD-1001", "stock": { "count": 42 } }'
```

## 매핑 규칙 형식

```json
{ "from": "user.name", "to": "customer.fullName", "transform": "uppercase" }
```

지원 `transform`: `uppercase`, `lowercase`, `trim`, `toNumber`, `toString`, `toBoolean`, `isoDate`

## 라우팅 규칙 형식

```json
{ "field": "stock.count", "operator": "lt", "value": 100 }
```

지원 `operator`: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`. 조건에 맞지 않는 메시지는
목적지로 전송되지 않고 "filtered"로 집계됩니다.

## 커넥터 설정

```json
{ "type": "file", "path": "./data/in.json" }
{ "type": "memory", "queue": "queue-name" }
{ "type": "http", "url": "https://example.com/api", "method": "POST" }
```

## 데이터 저장

Flow 정의와 실행 이력은 `data/smart-esb.sqlite`(SQLite, WAL 모드)에 저장됩니다.
`.env`의 `DATA_DIR`로 위치를 바꿀 수 있으며, 파일은 `.gitignore`에 포함되어 커밋되지 않습니다.

## 개발

```bash
npm run test    # vitest
npm run build   # tsc → dist/
npm start       # dist/index.js 실행
```
