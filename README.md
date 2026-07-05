# smart-esb

연계(ESB) 실행 로그를 모니터링하는 대시보드입니다. 지금은 모니터링 화면만 있고, 연계 실행
기능(Flow/템플릿)과 AI 기능은 잠시 빼두고 하나씩 추가할 예정입니다.

## 빠른 시작

```bash
npm install
cp .env.example .env
npm run seed:demo   # 더미 실행 로그를 채워서 모니터링 화면을 바로 확인
npm run dev         # http://localhost:4000
```

브라우저에서 `http://localhost:4000` 접속하면 실행 로그 테이블이 보입니다.

## API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/monitoring/runs?flowId=&limit=` | 실행 로그 (전체 또는 특정 flowId) |
| GET | `/health` | 헬스체크 |

## 데이터 저장

실행 로그는 `data/smart-esb.sqlite`(SQLite, WAL 모드) `flow_runs` 테이블에 저장됩니다.
`.env`의 `DATA_DIR`로 위치를 바꿀 수 있고, 이 파일은 `.gitignore`에 포함되어 커밋되지 않습니다.

`npm run seed:demo`는 `scripts/seed-monitoring-demo.ts`를 실행해 가상의 Flow 4개에 대해
최근 3일치 더미 실행 로그(성공/실패 섞임, 실패 원인 메시지 포함)를 채워 넣습니다.

## 개발

```bash
npm run test    # vitest
npm run build   # tsc → dist/
npm start       # dist/index.js 실행
```
