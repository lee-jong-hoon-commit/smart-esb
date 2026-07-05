# smart-esb

한국 기업환경에서 자주 쓰는 연계(ESB) 시나리오를 템플릿으로 바로 실행하고,
실행 현황을 모니터링하며, 챗봇에게 자연어로 물어봐서 에러 현황을 정리받을 수 있는 도구입니다.

## 핵심 개념

- **템플릿**: 파일 배치, DB 폴링, REST 실시간, 레거시 파일 브릿지 등 4가지 실무 시나리오를
  버튼 한 번으로 바로 실행 가능한 Flow로 만들 수 있습니다 (`GET /api/templates`).
- **Flow**: 소스 커넥터 → (매핑/변환) → 목적지 커넥터로 구성된 연계 단위. `file` / `http` /
  `memory`(웹훅 실시간) / `db`(SQLite 테이블 폴링, watermark 기반) 커넥터를 지원합니다.
- **스케줄러**: Flow에 cron 표현식을 지정하면 (`node-cron`) 배치/폴링 시나리오가 자동으로 실행됩니다.
- **웹훅 실시간 수신**: `POST /webhook/:queue`로 들어온 요청은 폴링 없이 즉시 처리됩니다.
- **모니터링 대시보드**: 전체 Flow의 실행 이력(성공/실패/에러 메시지)을 한눈에 봅니다.
- **챗봇**: "금일 연계 에러 현황 정리해줘" 처럼 물어보면, 실제 실행 로그(SQL로 결정론적 집계)를
  근거로 Ollama가 자연어 요약을 답합니다. Ollama가 꺼져 있으면 통계 기반 평문 요약으로 자동 폴백합니다.

AI 엔진은 **Ollama(로컬·무료)** 만 사용합니다. 별도 API 키나 과금이 필요 없습니다.

## 빠른 시작

```bash
# 1) Ollama 설치(https://ollama.com) 후 모델 받기 (한 번만, 챗봇/AI 매핑 생성에만 필요)
ollama pull qwen2.5

# 2) 설치 및 실행
npm install
cp .env.example .env
npm run dev            # http://localhost:4000 (대시보드 UI + API)
```

브라우저에서 `http://localhost:4000` 접속 → **템플릿** 탭에서 시나리오를 골라
"이 템플릿으로 Flow 만들기" → **Flows** 탭에서 "실행" 또는 자동 스케줄 대기 →
**모니터링** 탭에서 결과 확인 → **챗봇** 탭에서 에러 현황 질문.

Ollama가 꺼져 있어도 템플릿/Flow 생성·실행·스케줄·웹훅·모니터링·챗봇(통계 요약)까지 전부
정상 동작합니다. AI가 관여하는 부분은 `/api/mapping/generate`(에러 반환)와 챗봇의 자연어
문장 생성(평문 요약으로 대체)뿐입니다.

## 연계 패턴 템플릿

| 템플릿 | 패턴 | 소스 → 목적지 | 실행 방식 |
|---|---|---|---|
| 일 배치 정산 파일 연계 | 파일 배치 | file → file | 매일 01:00 (cron) |
| DB 폴링 기반 신규 주문 연계 | DB 폴링 | db(orders, watermark) → http | 5분마다 (cron) |
| REST 실시간 연계 (쇼핑몰 → 사내 ERP) | 실시간 API | memory(webhook) → http | 웹훅 수신 즉시 |
| 레거시 파일 브릿지 연계 | 파일 배치 | file → http | 1분마다 (cron) |

DB 폴링 템플릿은 데모용 SQLite `orders` 테이블(샘플 3건 포함)을 사용합니다. HTTP 목적지는
기본으로 `/api/_demo/echo`(자체 에코 엔드포인트)를 가리키므로 실제 시스템 없이도 바로 테스트할
수 있습니다. 운영에 쓰려면 Flow의 `destination.url`을 실제 사내/외부 API 주소로 바꾸면 됩니다.

## API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/templates` | 템플릿 목록 |
| GET | `/api/templates/:id` | 템플릿 상세 |
| POST | `/api/templates/:id/instantiate` | 템플릿으로 Flow 생성 |
| GET | `/api/flows` | Flow 목록 |
| POST | `/api/flows` | Flow 직접 생성 |
| GET | `/api/flows/:id` | Flow 조회 |
| DELETE | `/api/flows/:id` | Flow 삭제 |
| POST | `/api/flows/:id/run` | Flow 즉시 실행 |
| POST | `/webhook/:queue` | 웹훅 실시간 수신 (해당 큐를 source로 쓰는 모든 Flow 실행) |
| POST | `/api/mapping/generate` | 소스/타겟 샘플로 AI 매핑 규칙 생성 |
| GET | `/api/monitoring/runs?flowId=&limit=` | 실행 로그 (전체 또는 특정 Flow) |
| GET | `/api/monitoring/summary?from=&to=` | 기간별 Flow 실패/에러 집계 |
| POST | `/api/chat` | 자연어 질문 → 실행 로그 기반 요약 답변 |

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
{ "type": "db", "table": "orders", "watermarkColumn": "id", "filter": { "column": "status", "equals": "NEW" } }
```

`db` 커넥터는 `watermarkColumn` 기준으로 이전 실행 이후 새로 생긴 행만 조회합니다(Flow별로
watermark를 독립적으로 추적). destination으로 쓰면 페이로드 필드를 그대로 컬럼에 INSERT합니다.

## 챗봇 동작 방식

질문에서 "오늘/금일", "어제", "이번주", "최근 N시간", "최근 N일" 같은 표현을 감지해 조회 기간을
**결정론적으로**(정규식) 정하고, 그 기간의 실행 로그를 SQL로 집계합니다. 이 집계 데이터를
Ollama에 넘겨 자연어 문장으로 다듬기만 하므로, 답변에 사용되는 수치 자체는 항상 실제 로그와
일치합니다. Ollama가 꺼져 있으면 같은 집계 데이터로 만든 평문 요약을 그대로 반환합니다.

## 데이터 저장

Flow 정의, 실행 로그, watermark, 데모용 `orders` 테이블은 모두 `data/smart-esb.sqlite`
(SQLite, WAL 모드)에 저장됩니다. `.env`의 `DATA_DIR`로 위치를 바꿀 수 있고, 이 파일은
`.gitignore`에 포함되어 커밋되지 않습니다.

## 개발

```bash
npm run test    # vitest
npm run build   # tsc → dist/
npm start       # dist/index.js 실행
```
