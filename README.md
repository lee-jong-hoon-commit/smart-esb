# smart-esb

연계(ESB) 트랜잭션을 모니터링하고, 챗봇에게 물어보면 현황을 요약해주는 대시보드입니다.
지금은 모니터링 + 챗봇만 있고, 연계 실행 기능(Flow/템플릿)은 잠시 빼두고 하나씩 추가할 예정입니다.
**AI는 전혀 쓰지 않습니다** — 챗봇도 실행 로그를 SQL로 집계한 평문 요약으로만 답합니다.

## 빠른 시작

```bash
npm install
cp .env.example .env
npm run seed:demo   # 더미 트랜잭션을 채워서 화면을 바로 확인
npm run dev         # http://localhost:4000
```

브라우저에서 `http://localhost:4000` 접속 → **모니터링** 탭에서 트랜잭션 목록,
**챗봇** 탭에서 "금일 연계 에러 현황 정리해줘" 같은 질문을 해보세요.

## 모니터링 화면

트랜잭션 목록은 다음 컬럼으로 표시됩니다: **트랜잭션ID, 인터페이스명(인터페이스ID), 연계
시작시간, 연계 종료시간, 연계 건수, 결과(성공/부분실패/실패), 에러내용, 소요시간**.
목록은 페이지네이션되어 있고(기본 20건/페이지), 행을 클릭하면 해당 트랜잭션에 포함된
**레코드별 상세 데이터**(실제 payload, 개별 성공/실패 여부, 에러 메시지)를 볼 수 있습니다.

## 챗봇 동작 방식

질문에서 "오늘/금일", "어제", "이번주", "최근 N시간", "최근 N일" 같은 표현을 정규식으로 감지해
조회 기간을 정하고, 그 기간의 트랜잭션을 SQL로 집계해서 고정된 형식의 문장으로 답합니다.
AI를 전혀 호출하지 않으므로 항상 같은 입력에는 같은 답이 나옵니다.

## API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/monitoring/runs?page=&pageSize=&interfaceId=` | 트랜잭션 목록 (페이지네이션) |
| GET | `/api/monitoring/runs/:transactionId` | 트랜잭션 상세 (레코드별 payload/상태/에러 포함) |
| GET | `/api/monitoring/summary?from=&to=` | 기간별 인터페이스 성공/부분실패/실패 집계 |
| POST | `/api/chat` | `{ "question": "..." }` → 실행 로그 기반 평문 요약 답변 |
| GET | `/health` | 헬스체크 |

## 데이터 저장

트랜잭션은 `data/smart-esb.sqlite`(SQLite, WAL 모드) `interface_runs` 테이블에 저장됩니다.
레코드별 상세(payload, 개별 성공/실패, 에러)는 같은 행의 `records_json` 컬럼에 JSON으로
저장되어 상세 조회 시에만 함께 내려줍니다. `.env`의 `DATA_DIR`로 위치를 바꿀 수 있고, 이
파일은 `.gitignore`에 포함되어 커밋되지 않습니다.

`npm run seed:demo`는 `scripts/seed-monitoring-demo.ts`를 실행해 가상의 인터페이스 4개에 대해
최근 3일치 더미 트랜잭션(성공/부분실패/실패 섞임, 레코드별 상세 데이터 포함)을 채워 넣습니다.

## 개발

```bash
npm run test    # vitest
npm run build   # tsc → dist/
npm start       # dist/index.js 실행
```
