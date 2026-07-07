const state = {
  page: 1,
  pageSize: 20,
};

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const message = data && data.error ? JSON.stringify(data.error) : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function resultTag(result) {
  if (result === "SUCCESS") return '<span class="tag tag-ok">성공</span>';
  if (result === "PARTIAL") return '<span class="tag tag-partial">부분실패</span>';
  return '<span class="tag tag-fail">실패</span>';
}

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

function activateTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tab}`));
  if (tab === "connectors") loadConnectors();
  if (tab === "stats") loadDailyStats();
  if (tab === "interfaces") loadIfMgmt();
  if (tab === "resources") loadResMgmt();
  if (tab === "nodes") loadNodeMgmt();
  if (tab === "dashboard") loadDashboard();
}

// ---------- Monitoring ----------
async function loadMonitoring() {
  const container = document.getElementById("monitoringTable");
  const pager = document.getElementById("monitoringPager");
  container.innerHTML = '<p class="hint">불러오는 중…</p>';
  try {
    const result = await api("GET", `/api/monitoring/runs?page=${state.page}&pageSize=${state.pageSize}`);
    if (result.rows.length === 0) {
      container.innerHTML = '<p class="hint">실행 이력이 없습니다.</p>';
      pager.innerHTML = "";
      return;
    }
    const rows = result.rows
      .map((r) => {
        const interfaceLabel = `${r.interfaceName} (${r.interfaceId})`;
        return `<tr data-transaction-id="${escapeHtml(r.transactionId)}">
          <td class="mono cell-ellipsis" title="${escapeHtml(r.transactionId)}">${escapeHtml(r.transactionId)}</td>
          <td class="cell-ellipsis" title="${escapeHtml(interfaceLabel)}">${escapeHtml(interfaceLabel)}</td>
          <td class="cell-ellipsis">${new Date(r.startedAt).toLocaleString()}</td>
          <td class="cell-ellipsis">${new Date(r.endedAt).toLocaleString()}</td>
          <td class="col-count">${r.failedCount > 0 ? `<span class="error-text">${r.failedCount}</span>` : r.failedCount}/${r.recordCount}</td>
          <td class="col-result">${resultTag(r.result)}</td>
          <td class="cell-ellipsis" title="${r.errorDetail ? escapeHtml(r.errorDetail) : ""}">${r.errorDetail ? `<span class="error-text">${escapeHtml(r.errorDetail)}</span>` : "-"}</td>
          <td class="col-duration">${r.durationMs}ms</td>
        </tr>`;
      })
      .join("");
    container.innerHTML = `
      <div class="table-scroll">
        <table class="mon-table">
          <colgroup>
            <col style="width: 16%" /><col style="width: 18%" /><col style="width: 12%" /><col style="width: 12%" />
            <col style="width: 6%" /><col style="width: 8%" /><col style="width: 20%" /><col style="width: 8%" />
          </colgroup>
          <thead>
            <tr>
              <th>트랜잭션ID</th><th>인터페이스명(ID)</th><th>시작시간</th><th>종료시간</th>
              <th>건수</th><th>결과</th><th>에러내용</th><th>소요시간</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    container.querySelectorAll("tbody tr").forEach((tr) => {
      tr.addEventListener("click", () => showRunDetail(tr.dataset.transactionId));
    });

    pager.innerHTML = `
      <button class="secondary" id="pagerPrev" ${result.page <= 1 ? "disabled" : ""}>이전</button>
      <span class="hint">페이지 ${result.page} / ${result.totalPages} (총 ${result.total}건)</span>
      <button class="secondary" id="pagerNext" ${result.page >= result.totalPages ? "disabled" : ""}>다음</button>
    `;
    document.getElementById("pagerPrev")?.addEventListener("click", () => {
      state.page = Math.max(1, state.page - 1);
      loadMonitoring();
    });
    document.getElementById("pagerNext")?.addEventListener("click", () => {
      state.page = state.page + 1;
      loadMonitoring();
    });
  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
    pager.innerHTML = "";
  }
}
document.getElementById("monitoringRefreshBtn").addEventListener("click", () => {
  state.page = 1;
  loadMonitoring();
});

function renderRunDetail(run) {
  const title = document.getElementById("runDetailTitle");
  const body = document.getElementById("runDetailBody");
  title.textContent = `트랜잭션 상세: ${run.transactionId}`;

  const recordRows = run.records
    .map((r) => {
      const isFailed = r.status === "FAILED";
      return `<tr>
        <td class="mono">${escapeHtml(r.id)}</td>
        <td><pre class="result">${escapeHtml(JSON.stringify(r.payload, null, 2))}</pre></td>
        <td>${resultTag(isFailed ? "FAILED" : "SUCCESS")}</td>
        <td>${r.error ? `<span class="error">${escapeHtml(r.error)}</span>` : "-"}</td>
        <td>${isFailed ? `<button class="secondary resend-btn" data-record-id="${escapeHtml(r.id)}">재전송</button>` : "-"}</td>
      </tr>`;
    })
    .join("");

  body.innerHTML = `
    <table>
      <tbody>
        <tr><th>인터페이스</th><td>${escapeHtml(run.interfaceName)} (${escapeHtml(run.interfaceId)})</td></tr>
        <tr><th>시작시간</th><td>${new Date(run.startedAt).toLocaleString()}</td></tr>
        <tr><th>종료시간</th><td>${new Date(run.endedAt).toLocaleString()}</td></tr>
        <tr><th>소요시간</th><td>${run.durationMs}ms</td></tr>
        <tr><th>건수</th><td>${run.failedCount}/${run.recordCount}</td></tr>
        <tr><th>결과</th><td>${resultTag(run.result)}</td></tr>
        <tr><th>에러내용</th><td>${run.errorDetail ? `<span class="error">${escapeHtml(run.errorDetail)}</span>` : "-"}</td></tr>
      </tbody>
    </table>
    <h3>레코드별 상세 (${run.records.length}건)</h3>
    ${
      run.records.length
        ? `<table>
            <thead><tr><th>레코드ID</th><th>데이터</th><th>상태</th><th>에러</th><th>작업</th></tr></thead>
            <tbody>${recordRows}</tbody>
          </table>`
        : '<p class="hint">레코드 상세 데이터가 없습니다.</p>'
    }
  `;

  body.querySelectorAll(".resend-btn").forEach((btn) => {
    btn.addEventListener("click", () => resendRecord(run.transactionId, btn.dataset.recordId, btn));
  });
}

async function showRunDetail(transactionId) {
  const detail = document.getElementById("runDetail");
  const title = document.getElementById("runDetailTitle");
  const body = document.getElementById("runDetailBody");
  try {
    const run = await api("GET", `/api/monitoring/runs/${encodeURIComponent(transactionId)}`);
    detail.hidden = false;
    renderRunDetail(run);
    detail.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    detail.hidden = false;
    title.textContent = "트랜잭션 상세";
    body.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

async function resendRecord(transactionId, recordId, btn) {
  btn.disabled = true;
  btn.textContent = "재전송 중…";
  try {
    const updated = await api("POST", `/api/monitoring/runs/${encodeURIComponent(transactionId)}/records/${encodeURIComponent(recordId)}/resend`);
    renderRunDetail(updated);
    await loadMonitoring();
  } catch (err) {
    alert(`재전송 실패: ${err.message}`);
    btn.disabled = false;
    btn.textContent = "재전송";
  }
}
document.getElementById("runDetailCloseBtn").addEventListener("click", () => {
  document.getElementById("runDetail").hidden = true;
});

// ---------- Connector monitoring ----------
function formatLastRunAt(iso) {
  return iso ? new Date(iso).toLocaleString() : "-";
}

function formatDurationSec(sec) {
  if (sec === null || sec === undefined) return "-";
  if (sec < 60) return `${sec}초`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 ${sec % 60}초`;
  const hr = Math.floor(min / 60);
  return `${hr}시간 ${min % 60}분`;
}

function scheduleStatusTag(status) {
  if (status === "정상") return '<span class="tag tag-ok">정상</span>';
  if (status === "지연") return '<span class="tag tag-fail">지연</span>';
  return '<span class="tag">알수없음</span>';
}

function recentErrorsBlock(errors) {
  if (!errors || errors.length === 0) return "-";
  return `<ul class="recent-errors">${errors.map((e) => `<li class="error-text">${escapeHtml(e)}</li>`).join("")}</ul>`;
}

function connectorTypeFields(c) {
  if (c.connectorType === "QUEUE") {
    const statusClass = c.status === "정상" ? "tag-ok" : "tag-fail";
    return `
      <tr><th>경로</th><td>${escapeHtml(c.source)} → ${escapeHtml(c.destination)} (큐: ${escapeHtml(c.queueName)})</td></tr>
      <tr><th>상태</th><td><span class="tag ${statusClass}">${escapeHtml(c.status)}</span></td></tr>
      <tr><th>적체 건수</th><td>${c.backlogCount}건</td></tr>
      <tr><th>최고 적체 시간</th><td>${formatDurationSec(c.oldestBacklogAgeSec)}</td></tr>
    `;
  }
  if (c.connectorType === "HTTP") {
    return `
      <tr><th>호출 주소</th><td class="mono">${escapeHtml(c.method)} ${escapeHtml(c.url)}</td></tr>
      <tr><th>서비스 IP</th><td class="mono">${escapeHtml(c.serviceIp)}</td></tr>
      <tr><th>타임아웃</th><td>${c.timeoutMs}ms</td></tr>
      <tr><th>느린 호출 비율</th><td>${c.slowRunRatePct}%</td></tr>
    `;
  }
  if (c.connectorType === "DB") {
    return `
      <tr><th>테이블</th><td class="mono">${escapeHtml(c.table)}</td></tr>
      <tr><th>워터마크 컬럼</th><td class="mono">${escapeHtml(c.watermarkColumn)}</td></tr>
      <tr><th>폴링 주기</th><td>${c.pollIntervalSec ? `${c.pollIntervalSec}초` : "-"}</td></tr>
      <tr><th>스케줄 상태</th><td>${scheduleStatusTag(c.scheduleStatus)}</td></tr>
    `;
  }
  return `
    <tr><th>파일 경로</th><td class="mono">${escapeHtml(c.path)}</td></tr>
    <tr><th>폴링 주기</th><td>${c.pollIntervalSec ? `${c.pollIntervalSec}초` : "-"}</td></tr>
    <tr><th>스케줄 상태</th><td>${scheduleStatusTag(c.scheduleStatus)}</td></tr>
  `;
}

const CONNTYPE_META = {
  HTTP: { title: "HTTP 커넥터 모니터링", hint: "오늘 호출 건수/성공/실패, 서비스 IP, 평균/최소/최대 소요시간, 느린 호출 비율을 확인합니다." },
  QUEUE: { title: "QUEUE 커넥터 모니터링", hint: "큐 경로(출발 → 도착), 적체 건수, 최고 적체 시간, 처리 상태를 확인합니다." },
  DB: { title: "DB 커넥터 모니터링", hint: "폴링 주기 대비 마지막 실행 시각을 기준으로 지연 여부를 확인합니다." },
  FILE: { title: "FILE 커넥터 모니터링", hint: "폴링 주기 대비 마지막 실행 시각을 기준으로 지연 여부를 확인합니다." },
};

const connState = {
  type: "HTTP",
  page: 1,
  pageSize: 20,
  search: "",
};

// 검색어가 있으면 현재 선택된 소메뉴(타입)와 상관없이 모든 타입을 대상으로 찾습니다.
// 검색어가 없을 때만 소메뉴가 고른 타입으로 좁혀서 보여줍니다.
function updateConnectorsHeader() {
  const title = document.getElementById("connectorsTitle");
  const hint = document.getElementById("connectorsHint");
  if (connState.search) {
    title.textContent = "커넥터 검색 결과 (전체 타입)";
    hint.textContent = "검색어가 있는 동안은 선택한 소메뉴와 상관없이 모든 커넥터 타입에서 찾습니다.";
  } else {
    const meta = CONNTYPE_META[connState.type];
    title.textContent = meta.title;
    hint.textContent = meta.hint;
  }
}

// 검색 중일 때는 결과에 실제로 포함된 커넥터 타입의 소메뉴만 색칠하고,
// 검색어가 없을 때는 현재 선택된 소메뉴 하나만 색칠합니다.
function updateConntypeHighlight(resultTypes) {
  document.querySelectorAll(".conntype-btn").forEach((b) => {
    const isActive = connState.search ? resultTypes.has(b.dataset.conntype) : b.dataset.conntype === connState.type;
    b.classList.toggle("active", isActive);
  });
}

document.querySelectorAll(".conntype-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    connState.type = btn.dataset.conntype;
    connState.page = 1;
    connState.search = "";
    document.getElementById("connectorsSearchInput").value = "";
    updateConnectorsHeader();
    updateConntypeHighlight(new Set());
    loadConnectors();
  });
});
updateConnectorsHeader();

async function loadConnectors() {
  const container = document.getElementById("connectorsList");
  const pager = document.getElementById("connectorsPager");
  container.innerHTML = '<p class="hint">불러오는 중…</p>';
  try {
    const params = new URLSearchParams({
      page: String(connState.page),
      pageSize: String(connState.pageSize),
    });
    if (connState.search) {
      params.set("search", connState.search);
    } else {
      params.set("type", connState.type);
    }
    const result = await api("GET", `/api/connectors?${params}`);
    updateConntypeHighlight(new Set(result.rows.map((r) => r.connectorType)));
    if (result.rows.length === 0) {
      container.innerHTML = '<p class="hint">등록된 인터페이스가 없습니다.</p>';
      pager.innerHTML = "";
      return;
    }
    container.innerHTML = `<div class="connector-grid">${result.rows
      .map(
        (c) => `
      <div class="card connector-card">
        <span class="tag connector-type-badge">${escapeHtml(c.connectorType)}</span>
        <h3>${escapeHtml(c.interfaceName)}</h3>
        <table>
          <tbody>
            ${connectorTypeFields(c)}
            <tr><th>오늘 처리</th><td>${c.todayCount}건 (성공 ${c.todaySuccess} / 실패 ${c.todayFailed}, 실패율 ${c.failureRatePct}%)</td></tr>
            <tr><th>소요시간</th><td>평균 ${c.avgDurationMs}ms (최소 ${c.minDurationMs}ms / 최대 ${c.maxDurationMs}ms)</td></tr>
            <tr><th>마지막 처리</th><td>${formatLastRunAt(c.lastRunAt)}</td></tr>
            <tr><th>최근 에러</th><td>${recentErrorsBlock(c.recentErrors)}</td></tr>
          </tbody>
        </table>
      </div>`,
      )
      .join("")}</div>`;

    pager.innerHTML = `
      <button class="secondary" id="connectorsPagerPrev" ${result.page <= 1 ? "disabled" : ""}>이전</button>
      <span class="hint">페이지 ${result.page} / ${result.totalPages} (총 ${result.total}개 인터페이스)</span>
      <button class="secondary" id="connectorsPagerNext" ${result.page >= result.totalPages ? "disabled" : ""}>다음</button>
    `;
    document.getElementById("connectorsPagerPrev")?.addEventListener("click", () => {
      connState.page = Math.max(1, connState.page - 1);
      loadConnectors();
    });
    document.getElementById("connectorsPagerNext")?.addEventListener("click", () => {
      connState.page += 1;
      loadConnectors();
    });
  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
    pager.innerHTML = "";
  }
}
document.getElementById("connectorsRefreshBtn").addEventListener("click", () => {
  connState.page = 1;
  loadConnectors();
});

let connectorsSearchDebounce;
document.getElementById("connectorsSearchInput").addEventListener("input", (e) => {
  clearTimeout(connectorsSearchDebounce);
  connectorsSearchDebounce = setTimeout(() => {
    connState.search = e.target.value;
    connState.page = 1;
    updateConnectorsHeader();
    loadConnectors();
  }, 300);
});

// ---------- Interface management ----------
const IFMGMT_TYPE_META = {
  HTTP: { title: "HTTP 인터페이스 관리", hint: "HTTP 커넥터 인터페이스를 등록/수정/삭제합니다." },
  QUEUE: { title: "QUEUE 인터페이스 관리", hint: "QUEUE 커넥터 인터페이스를 등록/수정/삭제합니다." },
  DB: { title: "DB 인터페이스 관리", hint: "DB 커넥터 인터페이스를 등록/수정/삭제합니다." },
  FILE: { title: "FILE 인터페이스 관리", hint: "FILE 커넥터 인터페이스를 등록/수정/삭제합니다." },
};

const IFMGMT_CONFIG_FIELDS = {
  HTTP: [
    { key: "url", label: "호출 주소(URL)", type: "text", required: true },
    { key: "method", label: "메서드", type: "text", required: true, placeholder: "GET, POST 등" },
    { key: "serviceIp", label: "서비스 IP", type: "text", required: true },
    { key: "timeoutMs", label: "타임아웃(ms)", type: "number", required: false },
  ],
  QUEUE: [
    { key: "source", label: "출발지", type: "text", required: true },
    { key: "destination", label: "도착지", type: "text", required: true },
    { key: "queueName", label: "큐 이름", type: "text", required: true },
  ],
  DB: [
    { key: "table", label: "테이블명", type: "text", required: true },
    { key: "watermarkColumn", label: "워터마크 컬럼", type: "text", required: true },
    { key: "pollIntervalSec", label: "폴링 주기(초)", type: "number", required: false },
  ],
  FILE: [
    { key: "path", label: "파일 경로", type: "text", required: true },
    { key: "pollIntervalSec", label: "폴링 주기(초)", type: "number", required: false },
  ],
};

function ifConfigSummary(entry) {
  const c = entry.config;
  if (entry.connectorType === "HTTP") return `${escapeHtml(c.method)} ${escapeHtml(c.url)} / IP ${escapeHtml(c.serviceIp)}${c.timeoutMs ? ` / 타임아웃 ${c.timeoutMs}ms` : ""}`;
  if (entry.connectorType === "QUEUE") return `${escapeHtml(c.source)} → ${escapeHtml(c.destination)} (큐: ${escapeHtml(c.queueName)})`;
  if (entry.connectorType === "DB") return `테이블 ${escapeHtml(c.table)} / 워터마크 ${escapeHtml(c.watermarkColumn)}${c.pollIntervalSec ? ` / 폴링 ${c.pollIntervalSec}초` : ""}`;
  return `경로 ${escapeHtml(c.path)}${c.pollIntervalSec ? ` / 폴링 ${c.pollIntervalSec}초` : ""}`;
}

const ifMgmtState = {
  type: "HTTP",
  page: 1,
  pageSize: 20,
  search: "",
};

function updateIfMgmtHeader() {
  const title = document.getElementById("ifMgmtTitle");
  const hint = document.getElementById("ifMgmtHint");
  if (ifMgmtState.search) {
    title.textContent = "인터페이스 검색 결과 (전체 타입)";
    hint.textContent = "검색어가 있는 동안은 선택한 소메뉴와 상관없이 모든 커넥터 타입에서 찾습니다.";
  } else {
    const meta = IFMGMT_TYPE_META[ifMgmtState.type];
    title.textContent = meta.title;
    hint.textContent = meta.hint;
  }
}

function updateIfMgmtHighlight(resultTypes) {
  document.querySelectorAll(".ifmgmt-type-btn").forEach((b) => {
    const isActive = ifMgmtState.search ? resultTypes.has(b.dataset.ifmgmttype) : b.dataset.ifmgmttype === ifMgmtState.type;
    b.classList.toggle("active", isActive);
  });
}

document.querySelectorAll(".ifmgmt-type-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    ifMgmtState.type = btn.dataset.ifmgmttype;
    ifMgmtState.page = 1;
    ifMgmtState.search = "";
    document.getElementById("ifMgmtSearchInput").value = "";
    updateIfMgmtHeader();
    updateIfMgmtHighlight(new Set());
    loadIfMgmt();
  });
});
updateIfMgmtHeader();

async function loadIfMgmt() {
  const container = document.getElementById("ifMgmtTable");
  const pager = document.getElementById("ifMgmtPager");
  container.innerHTML = '<p class="hint">불러오는 중…</p>';
  try {
    const params = new URLSearchParams({
      page: String(ifMgmtState.page),
      pageSize: String(ifMgmtState.pageSize),
    });
    if (ifMgmtState.search) {
      params.set("search", ifMgmtState.search);
    } else {
      params.set("type", ifMgmtState.type);
    }
    const result = await api("GET", `/api/interfaces?${params}`);
    updateIfMgmtHighlight(new Set(result.rows.map((r) => r.connectorType)));
    if (result.rows.length === 0) {
      container.innerHTML = '<p class="hint">등록된 인터페이스가 없습니다.</p>';
      pager.innerHTML = "";
      return;
    }
    const rows = result.rows
      .map(
        (entry) => `
      <tr data-interface-id="${escapeHtml(entry.interfaceId)}">
        <td class="mono cell-ellipsis" title="${escapeHtml(entry.interfaceId)}">${escapeHtml(entry.interfaceId)}</td>
        <td class="cell-ellipsis" title="${escapeHtml(entry.interfaceName)}">${escapeHtml(entry.interfaceName)}</td>
        <td><span class="tag connector-type-badge">${escapeHtml(entry.connectorType)}</span></td>
        <td class="cell-ellipsis" title="${ifConfigSummary(entry)}">${ifConfigSummary(entry)}</td>
        <td class="if-row-actions">
          <button class="secondary if-edit-btn">수정</button>
          <button class="secondary if-delete-btn">삭제</button>
        </td>
      </tr>`,
      )
      .join("");
    container.innerHTML = `
      <div class="table-scroll">
        <table class="mon-table">
          <colgroup>
            <col style="width: 20%" /><col style="width: 22%" /><col style="width: 10%" /><col style="width: 33%" /><col style="width: 15%" />
          </colgroup>
          <thead>
            <tr><th>인터페이스ID</th><th>이름</th><th>타입</th><th>설정 요약</th><th>작업</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    container.querySelectorAll("tbody tr").forEach((tr) => {
      const entry = result.rows.find((r) => r.interfaceId === tr.dataset.interfaceId);
      tr.querySelector(".if-edit-btn").addEventListener("click", () => openIfForm(entry));
      tr.querySelector(".if-delete-btn").addEventListener("click", () => deleteIfEntry(entry));
    });

    pager.innerHTML = `
      <button class="secondary" id="ifMgmtPagerPrev" ${result.page <= 1 ? "disabled" : ""}>이전</button>
      <span class="hint">페이지 ${result.page} / ${result.totalPages} (총 ${result.total}개 인터페이스)</span>
      <button class="secondary" id="ifMgmtPagerNext" ${result.page >= result.totalPages ? "disabled" : ""}>다음</button>
    `;
    document.getElementById("ifMgmtPagerPrev")?.addEventListener("click", () => {
      ifMgmtState.page = Math.max(1, ifMgmtState.page - 1);
      loadIfMgmt();
    });
    document.getElementById("ifMgmtPagerNext")?.addEventListener("click", () => {
      ifMgmtState.page += 1;
      loadIfMgmt();
    });
  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
    pager.innerHTML = "";
  }
}

let ifMgmtSearchDebounce;
document.getElementById("ifMgmtSearchInput").addEventListener("input", (e) => {
  clearTimeout(ifMgmtSearchDebounce);
  ifMgmtSearchDebounce = setTimeout(() => {
    ifMgmtState.search = e.target.value;
    ifMgmtState.page = 1;
    updateIfMgmtHeader();
    loadIfMgmt();
  }, 300);
});

async function deleteIfEntry(entry) {
  if (!confirm(`"${entry.interfaceName}" (${entry.interfaceId})를 삭제하시겠습니까?`)) return;
  try {
    await api("DELETE", `/api/interfaces/${encodeURIComponent(entry.interfaceId)}`);
    await loadIfMgmt();
  } catch (err) {
    alert(`삭제 실패: ${err.message}`);
  }
}

// ---------- Interface create/edit form ----------
let ifFormMode = "create"; // "create" | "edit"
let ifFormOriginalId = null;

function renderIfConfigFields(type, existingConfig) {
  const fields = IFMGMT_CONFIG_FIELDS[type];
  const container = document.getElementById("ifFieldConfig");
  container.innerHTML = fields
    .map((f) => {
      const value = existingConfig && existingConfig[f.key] !== undefined ? existingConfig[f.key] : "";
      return `<label>${f.label}${f.required ? "" : " (선택)"}
        <input type="${f.type}" id="ifCfg_${f.key}" data-key="${f.key}" value="${escapeHtml(String(value))}" ${f.required ? "required" : ""} placeholder="${escapeHtml(f.placeholder ?? "")}" />
      </label>`;
    })
    .join("");
}

function openIfForm(entry) {
  const form = document.getElementById("ifForm");
  const title = document.getElementById("ifFormTitle");
  const errorEl = document.getElementById("ifFormError");
  errorEl.hidden = true;
  const idInput = document.getElementById("ifFieldId");
  const nameInput = document.getElementById("ifFieldName");
  const typeSelect = document.getElementById("ifFieldType");

  if (entry) {
    ifFormMode = "edit";
    ifFormOriginalId = entry.interfaceId;
    title.textContent = `인터페이스 수정: ${entry.interfaceId}`;
    idInput.value = entry.interfaceId;
    idInput.disabled = true;
    nameInput.value = entry.interfaceName;
    typeSelect.value = entry.connectorType;
    typeSelect.disabled = true;
    renderIfConfigFields(entry.connectorType, entry.config);
  } else {
    ifFormMode = "create";
    ifFormOriginalId = null;
    title.textContent = "새 인터페이스 등록";
    idInput.value = "";
    idInput.disabled = false;
    nameInput.value = "";
    typeSelect.value = "HTTP";
    typeSelect.disabled = false;
    renderIfConfigFields("HTTP", null);
  }
  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeIfForm() {
  document.getElementById("ifForm").hidden = true;
}

document.getElementById("ifMgmtCreateBtn").addEventListener("click", () => openIfForm(null));
document.getElementById("ifFormCloseBtn").addEventListener("click", closeIfForm);
document.getElementById("ifFieldType").addEventListener("change", (e) => {
  if (ifFormMode === "create") renderIfConfigFields(e.target.value, null);
});

document.getElementById("ifFormEl").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("ifFormError");
  errorEl.hidden = true;

  const interfaceId = document.getElementById("ifFieldId").value.trim();
  const interfaceName = document.getElementById("ifFieldName").value.trim();
  const connectorType = document.getElementById("ifFieldType").value;
  const config = {};
  document.querySelectorAll("#ifFieldConfig [data-key]").forEach((input) => {
    if (input.value !== "") config[input.dataset.key] = input.value;
  });

  const submitBtn = document.getElementById("ifFormSubmitBtn");
  submitBtn.disabled = true;
  try {
    if (ifFormMode === "create") {
      await api("POST", "/api/interfaces", { interfaceId, interfaceName, connectorType, config });
    } else {
      await api("PUT", `/api/interfaces/${encodeURIComponent(ifFormOriginalId)}`, {
        interfaceName,
        connectorType,
        config,
      });
    }
    closeIfForm();
    ifMgmtState.type = connectorType;
    ifMgmtState.search = "";
    document.getElementById("ifMgmtSearchInput").value = "";
    document.querySelectorAll(".ifmgmt-type-btn").forEach((b) => b.classList.toggle("active", b.dataset.ifmgmttype === connectorType));
    updateIfMgmtHeader();
    await loadIfMgmt();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------- Shared resources (DB/JMS) ----------
const RESMGMT_TYPE_META = {
  DB: { title: "DB 리소스 관리", hint: "DB 연결 리소스를 등록/수정/삭제합니다." },
  JMS: { title: "JMS 리소스 관리", hint: "JMS 큐 브로커 연결 리소스를 등록/수정/삭제합니다." },
};

const RESMGMT_CONFIG_FIELDS = {
  DB: [
    { key: "host", label: "호스트", type: "text", required: true },
    { key: "port", label: "포트", type: "number", required: true },
    { key: "database", label: "데이터베이스/SID", type: "text", required: true },
    { key: "driver", label: "드라이버", type: "text", required: true, placeholder: "oracle, mysql, postgresql 등" },
    { key: "username", label: "사용자명", type: "text", required: true },
  ],
  JMS: [
    { key: "brokerUrl", label: "브로커 URL", type: "text", required: true, placeholder: "tcp://host:61616" },
    { key: "connectionFactory", label: "커넥션 팩토리", type: "text", required: true },
    { key: "username", label: "사용자명", type: "text", required: true },
  ],
};

function resConfigSummary(entry) {
  const c = entry.config;
  if (entry.resourceType === "DB") return `${escapeHtml(c.driver)} / ${escapeHtml(c.host)}:${c.port}/${escapeHtml(c.database)} / ${escapeHtml(c.username)}`;
  return `${escapeHtml(c.brokerUrl)} / ${escapeHtml(c.connectionFactory)} / ${escapeHtml(c.username)}`;
}

const resMgmtState = {
  type: "DB",
  page: 1,
  pageSize: 20,
  search: "",
};

function updateResMgmtHeader() {
  const title = document.getElementById("resMgmtTitle");
  const hint = document.getElementById("resMgmtHint");
  if (resMgmtState.search) {
    title.textContent = "리소스 검색 결과 (전체 타입)";
    hint.textContent = "검색어가 있는 동안은 선택한 소메뉴와 상관없이 모든 리소스 타입에서 찾습니다.";
  } else {
    const meta = RESMGMT_TYPE_META[resMgmtState.type];
    title.textContent = meta.title;
    hint.textContent = meta.hint;
  }
}

function updateResMgmtHighlight(resultTypes) {
  document.querySelectorAll(".resmgmt-type-btn").forEach((b) => {
    const isActive = resMgmtState.search ? resultTypes.has(b.dataset.resmgmttype) : b.dataset.resmgmttype === resMgmtState.type;
    b.classList.toggle("active", isActive);
  });
}

document.querySelectorAll(".resmgmt-type-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    resMgmtState.type = btn.dataset.resmgmttype;
    resMgmtState.page = 1;
    resMgmtState.search = "";
    document.getElementById("resMgmtSearchInput").value = "";
    updateResMgmtHeader();
    updateResMgmtHighlight(new Set());
    loadResMgmt();
  });
});
updateResMgmtHeader();

async function loadResMgmt() {
  const container = document.getElementById("resMgmtTable");
  const pager = document.getElementById("resMgmtPager");
  container.innerHTML = '<p class="hint">불러오는 중…</p>';
  try {
    const params = new URLSearchParams({
      page: String(resMgmtState.page),
      pageSize: String(resMgmtState.pageSize),
    });
    if (resMgmtState.search) {
      params.set("search", resMgmtState.search);
    } else {
      params.set("type", resMgmtState.type);
    }
    const result = await api("GET", `/api/resources?${params}`);
    updateResMgmtHighlight(new Set(result.rows.map((r) => r.resourceType)));
    if (result.rows.length === 0) {
      container.innerHTML = '<p class="hint">등록된 리소스가 없습니다.</p>';
      pager.innerHTML = "";
      return;
    }
    const rows = result.rows
      .map(
        (entry) => `
      <tr data-resource-id="${escapeHtml(entry.resourceId)}">
        <td class="mono cell-ellipsis" title="${escapeHtml(entry.resourceId)}">${escapeHtml(entry.resourceId)}</td>
        <td class="cell-ellipsis" title="${escapeHtml(entry.resourceName)}">${escapeHtml(entry.resourceName)}</td>
        <td><span class="tag connector-type-badge">${escapeHtml(entry.resourceType)}</span></td>
        <td class="cell-ellipsis" title="${resConfigSummary(entry)}">${resConfigSummary(entry)}</td>
        <td class="if-row-actions">
          <button class="secondary res-edit-btn">수정</button>
          <button class="secondary res-delete-btn">삭제</button>
        </td>
      </tr>`,
      )
      .join("");
    container.innerHTML = `
      <div class="table-scroll">
        <table class="mon-table">
          <colgroup>
            <col style="width: 20%" /><col style="width: 22%" /><col style="width: 10%" /><col style="width: 33%" /><col style="width: 15%" />
          </colgroup>
          <thead>
            <tr><th>리소스ID</th><th>이름</th><th>타입</th><th>설정 요약</th><th>작업</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    container.querySelectorAll("tbody tr").forEach((tr) => {
      const entry = result.rows.find((r) => r.resourceId === tr.dataset.resourceId);
      tr.querySelector(".res-edit-btn").addEventListener("click", () => openResForm(entry));
      tr.querySelector(".res-delete-btn").addEventListener("click", () => deleteResEntry(entry));
    });

    pager.innerHTML = `
      <button class="secondary" id="resMgmtPagerPrev" ${result.page <= 1 ? "disabled" : ""}>이전</button>
      <span class="hint">페이지 ${result.page} / ${result.totalPages} (총 ${result.total}개 리소스)</span>
      <button class="secondary" id="resMgmtPagerNext" ${result.page >= result.totalPages ? "disabled" : ""}>다음</button>
    `;
    document.getElementById("resMgmtPagerPrev")?.addEventListener("click", () => {
      resMgmtState.page = Math.max(1, resMgmtState.page - 1);
      loadResMgmt();
    });
    document.getElementById("resMgmtPagerNext")?.addEventListener("click", () => {
      resMgmtState.page += 1;
      loadResMgmt();
    });
  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
    pager.innerHTML = "";
  }
}

let resMgmtSearchDebounce;
document.getElementById("resMgmtSearchInput").addEventListener("input", (e) => {
  clearTimeout(resMgmtSearchDebounce);
  resMgmtSearchDebounce = setTimeout(() => {
    resMgmtState.search = e.target.value;
    resMgmtState.page = 1;
    updateResMgmtHeader();
    loadResMgmt();
  }, 300);
});

async function deleteResEntry(entry) {
  if (!confirm(`"${entry.resourceName}" (${entry.resourceId})를 삭제하시겠습니까?`)) return;
  try {
    await api("DELETE", `/api/resources/${encodeURIComponent(entry.resourceId)}`);
    await loadResMgmt();
  } catch (err) {
    alert(`삭제 실패: ${err.message}`);
  }
}

// ---------- Resource create/edit form ----------
let resFormMode = "create"; // "create" | "edit"
let resFormOriginalId = null;

function renderResConfigFields(type, existingConfig) {
  const fields = RESMGMT_CONFIG_FIELDS[type];
  const container = document.getElementById("resFieldConfig");
  container.innerHTML = fields
    .map((f) => {
      const value = existingConfig && existingConfig[f.key] !== undefined ? existingConfig[f.key] : "";
      return `<label>${f.label}
        <input type="${f.type}" id="resCfg_${f.key}" data-key="${f.key}" value="${escapeHtml(String(value))}" ${f.required ? "required" : ""} placeholder="${escapeHtml(f.placeholder ?? "")}" />
      </label>`;
    })
    .join("");
}

function openResForm(entry) {
  const form = document.getElementById("resForm");
  const title = document.getElementById("resFormTitle");
  const errorEl = document.getElementById("resFormError");
  errorEl.hidden = true;
  const idInput = document.getElementById("resFieldId");
  const nameInput = document.getElementById("resFieldName");
  const typeSelect = document.getElementById("resFieldType");

  if (entry) {
    resFormMode = "edit";
    resFormOriginalId = entry.resourceId;
    title.textContent = `리소스 수정: ${entry.resourceId}`;
    idInput.value = entry.resourceId;
    idInput.disabled = true;
    nameInput.value = entry.resourceName;
    typeSelect.value = entry.resourceType;
    typeSelect.disabled = true;
    renderResConfigFields(entry.resourceType, entry.config);
  } else {
    resFormMode = "create";
    resFormOriginalId = null;
    title.textContent = "새 리소스 등록";
    idInput.value = "";
    idInput.disabled = false;
    nameInput.value = "";
    typeSelect.value = "DB";
    typeSelect.disabled = false;
    renderResConfigFields("DB", null);
  }
  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeResForm() {
  document.getElementById("resForm").hidden = true;
}

document.getElementById("resMgmtCreateBtn").addEventListener("click", () => openResForm(null));
document.getElementById("resFormCloseBtn").addEventListener("click", closeResForm);
document.getElementById("resFieldType").addEventListener("change", (e) => {
  if (resFormMode === "create") renderResConfigFields(e.target.value, null);
});

document.getElementById("resFormEl").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("resFormError");
  errorEl.hidden = true;

  const resourceId = document.getElementById("resFieldId").value.trim();
  const resourceName = document.getElementById("resFieldName").value.trim();
  const resourceType = document.getElementById("resFieldType").value;
  const config = {};
  document.querySelectorAll("#resFieldConfig [data-key]").forEach((input) => {
    if (input.value !== "") config[input.dataset.key] = input.value;
  });

  const submitBtn = document.getElementById("resFormSubmitBtn");
  submitBtn.disabled = true;
  try {
    if (resFormMode === "create") {
      await api("POST", "/api/resources", { resourceId, resourceName, resourceType, config });
    } else {
      await api("PUT", `/api/resources/${encodeURIComponent(resFormOriginalId)}`, {
        resourceName,
        resourceType,
        config,
      });
    }
    closeResForm();
    resMgmtState.type = resourceType;
    resMgmtState.search = "";
    document.getElementById("resMgmtSearchInput").value = "";
    document.querySelectorAll(".resmgmt-type-btn").forEach((b) => b.classList.toggle("active", b.dataset.resmgmttype === resourceType));
    updateResMgmtHeader();
    await loadResMgmt();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------- Node management (adapter/agent/ESB) ----------
function nodeStatusTag(status) {
  if (status === "정상") return '<span class="tag tag-ok">정상</span>';
  if (status === "경고") return '<span class="tag tag-partial">경고</span>';
  if (status === "장애") return '<span class="tag tag-fail">장애</span>';
  return '<span class="tag">알수없음</span>';
}

function resourceBarClass(pct) {
  if (pct === null || pct === undefined) return "hbar-fill";
  if (pct < 70) return "hbar-fill hbar-fill-ok";
  if (pct < 90) return "hbar-fill hbar-fill-warn";
  return "hbar-fill hbar-fill-danger";
}

function formatPct(pct) {
  return pct === null || pct === undefined ? "-" : `${pct}%`;
}

const NODETYPE_META = {
  ESB: { title: "ESB 노드 관리", hint: "ESB 엔진 인스턴스를 등록/수정/삭제합니다." },
  AGENT: { title: "AGENT 노드 관리", hint: "연계 에이전트를 등록/수정/삭제합니다." },
  ADAPTER: { title: "ADAPTER 노드 관리", hint: "커넥터 어댑터를 등록/수정/삭제합니다." },
};

const NODE_CONFIG_FIELDS = {
  ESB: [
    { key: "port", label: "포트", type: "number", required: true },
    { key: "version", label: "버전", type: "text", required: true },
  ],
  AGENT: [
    { key: "targetSystem", label: "대상 시스템", type: "text", required: true },
    { key: "version", label: "버전", type: "text", required: true },
  ],
  ADAPTER: [
    { key: "adapterKind", label: "어댑터 종류", type: "text", required: true, placeholder: "DB_ADAPTER, FILE_ADAPTER 등" },
    { key: "version", label: "버전", type: "text", required: true },
  ],
};

function nodeConfigSummary(entry) {
  const c = entry.config;
  if (entry.nodeType === "ESB") return `포트 ${c.port} / v${escapeHtml(c.version)}`;
  if (entry.nodeType === "AGENT") return `대상: ${escapeHtml(c.targetSystem)} / v${escapeHtml(c.version)}`;
  return `${escapeHtml(c.adapterKind)} / v${escapeHtml(c.version)}`;
}

const nodeMgmtState = {
  type: "ESB",
  page: 1,
  pageSize: 20,
  search: "",
};

function updateNodeMgmtHeader() {
  const title = document.getElementById("nodeMgmtTitle");
  const hint = document.getElementById("nodeMgmtHint");
  if (nodeMgmtState.search) {
    title.textContent = "노드 검색 결과 (전체 타입)";
    hint.textContent = "검색어가 있는 동안은 선택한 소메뉴와 상관없이 모든 노드 타입에서 찾습니다.";
  } else {
    const meta = NODETYPE_META[nodeMgmtState.type];
    title.textContent = meta.title;
    hint.textContent = meta.hint;
  }
}

function updateNodeMgmtHighlight(resultTypes) {
  document.querySelectorAll(".nodemgmt-type-btn").forEach((b) => {
    const isActive = nodeMgmtState.search ? resultTypes.has(b.dataset.nodemgmttype) : b.dataset.nodemgmttype === nodeMgmtState.type;
    b.classList.toggle("active", isActive);
  });
}

document.querySelectorAll(".nodemgmt-type-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    nodeMgmtState.type = btn.dataset.nodemgmttype;
    nodeMgmtState.page = 1;
    nodeMgmtState.search = "";
    document.getElementById("nodeMgmtSearchInput").value = "";
    updateNodeMgmtHeader();
    updateNodeMgmtHighlight(new Set());
    loadNodeMgmt();
  });
});
updateNodeMgmtHeader();

async function loadNodeMgmt() {
  const container = document.getElementById("nodeMgmtTable");
  const pager = document.getElementById("nodeMgmtPager");
  container.innerHTML = '<p class="hint">불러오는 중…</p>';
  try {
    const params = new URLSearchParams({
      page: String(nodeMgmtState.page),
      pageSize: String(nodeMgmtState.pageSize),
    });
    if (nodeMgmtState.search) {
      params.set("search", nodeMgmtState.search);
    } else {
      params.set("type", nodeMgmtState.type);
    }
    const result = await api("GET", `/api/nodes?${params}`);
    updateNodeMgmtHighlight(new Set(result.rows.map((r) => r.nodeType)));
    if (result.rows.length === 0) {
      container.innerHTML = '<p class="hint">등록된 노드가 없습니다.</p>';
      pager.innerHTML = "";
      return;
    }
    const rows = result.rows
      .map(
        (entry) => `
      <tr data-node-id="${escapeHtml(entry.nodeId)}">
        <td class="mono cell-ellipsis" title="${escapeHtml(entry.nodeId)}">${escapeHtml(entry.nodeId)}</td>
        <td class="cell-ellipsis" title="${escapeHtml(entry.nodeName)}">${escapeHtml(entry.nodeName)}</td>
        <td><span class="tag connector-type-badge">${escapeHtml(entry.nodeType)}</span></td>
        <td class="mono cell-ellipsis">${escapeHtml(entry.host)}</td>
        <td>${nodeStatusTag(entry.status)}</td>
        <td class="cell-ellipsis">CPU ${formatPct(entry.cpuPct)} / MEM ${formatPct(entry.memPct)} / DISK ${formatPct(entry.diskPct)}</td>
        <td class="cell-ellipsis" title="${nodeConfigSummary(entry)}">${nodeConfigSummary(entry)}</td>
        <td class="if-row-actions">
          <button class="secondary node-edit-btn">수정</button>
          <button class="secondary node-delete-btn">삭제</button>
        </td>
      </tr>`,
      )
      .join("");
    container.innerHTML = `
      <div class="table-scroll">
        <table class="mon-table">
          <colgroup>
            <col style="width: 12%" /><col style="width: 15%" /><col style="width: 8%" /><col style="width: 12%" />
            <col style="width: 8%" /><col style="width: 18%" /><col style="width: 15%" /><col style="width: 12%" />
          </colgroup>
          <thead>
            <tr><th>노드ID</th><th>이름</th><th>타입</th><th>호스트</th><th>상태</th><th>자원 사용률</th><th>설정 요약</th><th>작업</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    container.querySelectorAll("tbody tr").forEach((tr) => {
      const entry = result.rows.find((r) => r.nodeId === tr.dataset.nodeId);
      tr.querySelector(".node-edit-btn").addEventListener("click", () => openNodeForm(entry));
      tr.querySelector(".node-delete-btn").addEventListener("click", () => deleteNodeEntry(entry));
    });

    pager.innerHTML = `
      <button class="secondary" id="nodeMgmtPagerPrev" ${result.page <= 1 ? "disabled" : ""}>이전</button>
      <span class="hint">페이지 ${result.page} / ${result.totalPages} (총 ${result.total}개 노드)</span>
      <button class="secondary" id="nodeMgmtPagerNext" ${result.page >= result.totalPages ? "disabled" : ""}>다음</button>
    `;
    document.getElementById("nodeMgmtPagerPrev")?.addEventListener("click", () => {
      nodeMgmtState.page = Math.max(1, nodeMgmtState.page - 1);
      loadNodeMgmt();
    });
    document.getElementById("nodeMgmtPagerNext")?.addEventListener("click", () => {
      nodeMgmtState.page += 1;
      loadNodeMgmt();
    });
  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
    pager.innerHTML = "";
  }
}

let nodeMgmtSearchDebounce;
document.getElementById("nodeMgmtSearchInput").addEventListener("input", (e) => {
  clearTimeout(nodeMgmtSearchDebounce);
  nodeMgmtSearchDebounce = setTimeout(() => {
    nodeMgmtState.search = e.target.value;
    nodeMgmtState.page = 1;
    updateNodeMgmtHeader();
    loadNodeMgmt();
  }, 300);
});

async function deleteNodeEntry(entry) {
  if (!confirm(`"${entry.nodeName}" (${entry.nodeId})를 삭제하시겠습니까?`)) return;
  try {
    await api("DELETE", `/api/nodes/${encodeURIComponent(entry.nodeId)}`);
    await loadNodeMgmt();
  } catch (err) {
    alert(`삭제 실패: ${err.message}`);
  }
}

// ---------- Node create/edit form ----------
let nodeFormMode = "create"; // "create" | "edit"
let nodeFormOriginalId = null;

function renderNodeConfigFields(type, existingConfig) {
  const fields = NODE_CONFIG_FIELDS[type];
  const container = document.getElementById("nodeFieldConfig");
  container.innerHTML = fields
    .map((f) => {
      const value = existingConfig && existingConfig[f.key] !== undefined ? existingConfig[f.key] : "";
      return `<label>${f.label}
        <input type="${f.type}" id="nodeCfg_${f.key}" data-key="${f.key}" value="${escapeHtml(String(value))}" ${f.required ? "required" : ""} placeholder="${escapeHtml(f.placeholder ?? "")}" />
      </label>`;
    })
    .join("");
}

function openNodeForm(entry) {
  const form = document.getElementById("nodeForm");
  const title = document.getElementById("nodeFormTitle");
  const errorEl = document.getElementById("nodeFormError");
  errorEl.hidden = true;
  const idInput = document.getElementById("nodeFieldId");
  const nameInput = document.getElementById("nodeFieldName");
  const typeSelect = document.getElementById("nodeFieldType");
  const hostInput = document.getElementById("nodeFieldHost");

  if (entry) {
    nodeFormMode = "edit";
    nodeFormOriginalId = entry.nodeId;
    title.textContent = `노드 수정: ${entry.nodeId}`;
    idInput.value = entry.nodeId;
    idInput.disabled = true;
    nameInput.value = entry.nodeName;
    typeSelect.value = entry.nodeType;
    typeSelect.disabled = true;
    hostInput.value = entry.host;
    renderNodeConfigFields(entry.nodeType, entry.config);
  } else {
    nodeFormMode = "create";
    nodeFormOriginalId = null;
    title.textContent = "새 노드 등록";
    idInput.value = "";
    idInput.disabled = false;
    nameInput.value = "";
    typeSelect.value = "ESB";
    typeSelect.disabled = false;
    hostInput.value = "";
    renderNodeConfigFields("ESB", null);
  }
  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeNodeForm() {
  document.getElementById("nodeForm").hidden = true;
}

document.getElementById("nodeMgmtCreateBtn").addEventListener("click", () => openNodeForm(null));
document.getElementById("nodeFormCloseBtn").addEventListener("click", closeNodeForm);
document.getElementById("nodeFieldType").addEventListener("change", (e) => {
  if (nodeFormMode === "create") renderNodeConfigFields(e.target.value, null);
});

document.getElementById("nodeFormEl").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("nodeFormError");
  errorEl.hidden = true;

  const nodeId = document.getElementById("nodeFieldId").value.trim();
  const nodeName = document.getElementById("nodeFieldName").value.trim();
  const nodeType = document.getElementById("nodeFieldType").value;
  const host = document.getElementById("nodeFieldHost").value.trim();
  const config = {};
  document.querySelectorAll("#nodeFieldConfig [data-key]").forEach((input) => {
    if (input.value !== "") config[input.dataset.key] = input.value;
  });

  const submitBtn = document.getElementById("nodeFormSubmitBtn");
  submitBtn.disabled = true;
  try {
    if (nodeFormMode === "create") {
      await api("POST", "/api/nodes", { nodeId, nodeName, nodeType, host, config });
    } else {
      await api("PUT", `/api/nodes/${encodeURIComponent(nodeFormOriginalId)}`, {
        nodeName,
        nodeType,
        host,
        config,
      });
    }
    closeNodeForm();
    nodeMgmtState.type = nodeType;
    nodeMgmtState.search = "";
    document.getElementById("nodeMgmtSearchInput").value = "";
    document.querySelectorAll(".nodemgmt-type-btn").forEach((b) => b.classList.toggle("active", b.dataset.nodemgmttype === nodeType));
    updateNodeMgmtHeader();
    await loadNodeMgmt();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------- Dashboard ----------
const NODE_TYPE_LABEL = { ESB: "ESB", AGENT: "AGENT", ADAPTER: "ADAPTER" };
const NODE_STATUS_ORDER = ["정상", "경고", "장애", "알수없음"];

function renderDashboardOverview(overview) {
  const total = overview.totalNodes;
  const statusCount = (status) => overview.byStatus.find((s) => s.status === status)?.count ?? 0;
  const tileClass = { 정상: "success", 경고: "warn", 장애: "danger", 알수없음: "" };

  const tiles = [
    `<div class="stat-tile"><div class="stat-tile-label">전체 노드</div><div class="stat-tile-value">${total}</div></div>`,
    ...NODE_STATUS_ORDER.map(
      (status) =>
        `<div class="stat-tile"><div class="stat-tile-label">${status}</div><div class="stat-tile-value ${tileClass[status]}">${statusCount(status)}</div></div>`,
    ),
  ].join("");
  document.getElementById("dashboardStatTiles").innerHTML = tiles;

  const typeRows = overview.byType
    .map((t) => `<tr><td>${NODE_TYPE_LABEL[t.nodeType] ?? t.nodeType}</td><td>${t.count}</td></tr>`)
    .join("");
  document.getElementById("dashboardTypeTable").innerHTML = overview.byType.length
    ? `<table><thead><tr><th>타입</th><th>노드 수</th></tr></thead><tbody>${typeRows}</tbody></table>`
    : '<p class="hint">등록된 노드가 없습니다.</p>';
}

function renderResourceUsage(rows) {
  const container = document.getElementById("dashboardResourceUsage");
  if (rows.length === 0) {
    container.innerHTML = '<p class="hint">등록된 노드가 없습니다.</p>';
    return;
  }
  container.innerHTML = rows
    .map((r) => {
      const metrics = [
        ["CPU", r.cpuPct],
        ["MEM", r.memPct],
        ["DISK", r.diskPct],
      ]
        .map(
          ([label, pct]) => `
        <div class="hbar-row">
          <div class="hbar-label">${label}</div>
          <div class="hbar-track"><div class="${resourceBarClass(pct)}" style="width:${pct ?? 0}%"></div></div>
          <div class="hbar-value">${formatPct(pct)}</div>
        </div>`,
        )
        .join("");
      return `
      <div class="resource-node-card">
        <div class="resource-node-header">
          <span class="tag connector-type-badge">${escapeHtml(r.nodeType)}</span>
          <strong>${escapeHtml(r.nodeName)}</strong>
          ${nodeStatusTag(r.status)}
        </div>
        ${metrics}
      </div>`;
    })
    .join("");
}

function renderDashboardToday(daily) {
  const today = daily.series[daily.series.length - 1] ?? { count: 0, success: 0, failed: 0 };
  const failureRatePct = today.count > 0 ? Math.round((today.failed / today.count) * 1000) / 10 : 0;
  document.getElementById("dashboardTodayTiles").innerHTML = `
    <div class="stat-tile"><div class="stat-tile-label">오늘 전체 처리</div><div class="stat-tile-value">${today.count}</div></div>
    <div class="stat-tile"><div class="stat-tile-label">성공</div><div class="stat-tile-value success">${today.success}</div></div>
    <div class="stat-tile"><div class="stat-tile-label">실패</div><div class="stat-tile-value danger">${today.failed}</div></div>
    <div class="stat-tile"><div class="stat-tile-label">실패율</div><div class="stat-tile-value ${failureRatePct > 0 ? "warn" : ""}">${failureRatePct}%</div></div>
  `;
  const successPct = today.count > 0 ? Math.round((today.success / today.count) * 100) : 0;
  const failedPct = 100 - successPct;
  document.getElementById("dashboardTodayBar").innerHTML = `
    <div class="hbar-row">
      <div class="hbar-label">오늘</div>
      <div class="hbar-track">
        <div class="hbar-stack" style="width:100%">
          <div class="seg seg-success" style="width:${successPct}%"></div>
          ${today.failed > 0 ? `<div class="seg-gap-v"></div><div class="seg seg-failed" style="width:${failedPct}%"></div>` : ""}
        </div>
      </div>
      <div class="hbar-value">${today.count}건 (실패 ${today.failed})</div>
    </div>
  `;
}

async function loadDashboard() {
  try {
    const [overview, resourceUsage, daily] = await Promise.all([
      api("GET", "/api/dashboard/overview"),
      api("GET", "/api/dashboard/resource-usage"),
      api("GET", "/api/stats/daily?days=1"),
    ]);
    renderDashboardOverview(overview);
    renderResourceUsage(resourceUsage);
    renderDashboardToday(daily);
  } catch (err) {
    document.getElementById("dashboardStatTiles").innerHTML = `<p class="error">${err.message}</p>`;
  }
}
document.getElementById("dashboardRefreshBtn").addEventListener("click", loadDashboard);

// ---------- Stats / charts ----------
const CONNECTOR_TYPE_LABEL = { QUEUE: "큐", HTTP: "HTTP", DB: "DB", FILE: "FILE", UNKNOWN: "미등록" };

const statsState = {
  dailyDays: 30,
  interfacePage: 1,
  interfacePageSize: 20,
  interfaceSearch: "",
};

function formatShortDate(dateStr) {
  return dateStr.slice(5).replace("-", "/");
}

function formatBucketLabel(dateStr, bucket) {
  if (bucket === "day") return formatShortDate(dateStr);
  const [start, end] = dateStr.split("~");
  return end ? `${formatShortDate(start)}~${formatShortDate(end)}` : formatShortDate(start);
}

// ---------- Sub-tabs ----------
// .subtab-btn 클래스는 스타일 재사용을 위해 커넥터/인터페이스 관리의 타입 탭에도 붙어있으므로,
// 여기서는 실제 data-subtab 속성이 있는 버튼만 골라서 리스너를 답니다.
document.querySelectorAll(".subtab-btn[data-subtab]").forEach((btn) => {
  btn.addEventListener("click", () => activateSubtab(btn.dataset.subtab));
});

function activateSubtab(name) {
  document.querySelectorAll(".subtab-btn[data-subtab]").forEach((b) => b.classList.toggle("active", b.dataset.subtab === name));
  document.querySelectorAll(".subtab-panel").forEach((p) => p.classList.toggle("active", p.id === `substat-${name}`));
  if (name === "daily") loadDailyStats();
  if (name === "type") loadTypeStats();
  if (name === "interface") loadInterfaceStats();
}

function renderDailyChart({ bucket, series }) {
  const hint = document.getElementById("dailyBucketHint");
  hint.textContent =
    bucket === "week"
      ? "선택한 기간이 31일을 넘어 막대가 너무 많아지지 않도록 7일 단위로 묶어서 표시합니다."
      : "";

  const maxTotal = Math.max(1, ...series.map((d) => d.count));
  const maxBarPx = 140;
  // 버킷이 많아지면(예: 180일 -> 주간 26개) 축 라벨을 전부 찍으면 서로 겹치므로,
  // 라벨은 목표 개수(8개)만큼만 성기게 보여줍니다 (막대와 값 라벨은 그대로 전부 표시).
  const labelEvery = Math.max(1, Math.ceil(series.length / 8));
  const cols = series
    .map((d, i) => {
      const barPx = d.count > 0 ? Math.max(4, Math.round((d.count / maxTotal) * maxBarPx)) : 0;
      const failedPx = d.count > 0 ? Math.round((d.failed / d.count) * barPx) : 0;
      const successPx = barPx - failedPx;
      const label = formatBucketLabel(d.date, bucket);
      const showLabel = i % labelEvery === 0;
      const title = `${label} 총 ${d.count}건 (성공 ${d.success} / 실패 ${d.failed})`;
      return `
        <div class="chart-col">
          <div class="chart-value">${d.count || ""}</div>
          <div class="chart-stack" style="height:${barPx}px" title="${title}">
            <div class="seg seg-success" style="height:${successPx}px"></div>
            ${failedPx > 0 ? `<div class="seg-gap"></div><div class="seg seg-failed" style="height:${failedPx}px"></div>` : ""}
          </div>
          <div class="chart-axis-label">${showLabel ? label : ""}</div>
        </div>`;
    })
    .join("");
  document.getElementById("dailyChart").innerHTML = `<div class="table-scroll"><div class="chart-row">${cols}</div></div>`;

  const rows = series
    .map((d) => `<tr><td>${formatBucketLabel(d.date, bucket)}</td><td>${d.count}</td><td>${d.success}</td><td>${d.failed}</td></tr>`)
    .join("");
  document.getElementById("dailyTable").innerHTML = `
    <table><thead><tr><th>${bucket === "week" ? "기간" : "날짜"}</th><th>건수</th><th>성공</th><th>실패</th></tr></thead><tbody>${rows}</tbody></table>
  `;
}

function renderTypeChart(byConnectorType) {
  const maxCount = Math.max(1, ...byConnectorType.map((c) => c.count));
  const rows = byConnectorType
    .map((c) => {
      const pct = Math.max(2, Math.round((c.count / maxCount) * 100));
      const label = CONNECTOR_TYPE_LABEL[c.connectorType] ?? c.connectorType;
      return `
        <div class="hbar-row">
          <div class="hbar-label">${escapeHtml(label)}</div>
          <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%" title="${escapeHtml(label)}: ${c.count}건"></div></div>
          <div class="hbar-value">${c.count}건</div>
        </div>`;
    })
    .join("");
  document.getElementById("typeChart").innerHTML = rows || '<p class="hint">데이터가 없습니다.</p>';

  const tableRows = byConnectorType
    .map((c) => `<tr><td>${escapeHtml(CONNECTOR_TYPE_LABEL[c.connectorType] ?? c.connectorType)}</td><td>${c.count}</td><td>${c.success}</td><td>${c.failed}</td></tr>`)
    .join("");
  document.getElementById("typeTable").innerHTML = `
    <table><thead><tr><th>커넥터 타입</th><th>건수</th><th>성공</th><th>실패</th></tr></thead><tbody>${tableRows}</tbody></table>
  `;
}

function renderInterfaceChart(page) {
  const byInterface = page.rows;
  const maxCount = Math.max(1, ...byInterface.map((i) => i.count));
  const rows = byInterface
    .map((i) => {
      const widthPct = Math.max(2, Math.round((i.count / maxCount) * 100));
      const successPct = i.count > 0 ? Math.round((i.success / i.count) * 100) : 0;
      const failedPct = 100 - successPct;
      const title = `${i.interfaceName}: 총 ${i.count}건 (성공 ${i.success} / 실패 ${i.failed})`;
      return `
        <div class="hbar-row">
          <div class="hbar-label" title="${escapeHtml(i.interfaceName)}">${escapeHtml(i.interfaceName)}</div>
          <div class="hbar-track">
            <div class="hbar-stack" style="width:${widthPct}%" title="${escapeHtml(title)}">
              <div class="seg seg-success" style="width:${successPct}%"></div>
              ${i.failed > 0 ? `<div class="seg-gap-v"></div><div class="seg seg-failed" style="width:${failedPct}%"></div>` : ""}
            </div>
          </div>
          <div class="hbar-value">${i.count}건 (실패 ${i.failed})</div>
        </div>`;
    })
    .join("");
  document.getElementById("interfaceChart").innerHTML = rows || '<p class="hint">데이터가 없습니다.</p>';

  const tableRows = byInterface
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.interfaceName)}</td><td>${escapeHtml(CONNECTOR_TYPE_LABEL[i.connectorType] ?? i.connectorType)}</td><td>${i.count}</td><td>${i.success}</td><td>${i.failed}</td></tr>`,
    )
    .join("");
  document.getElementById("interfaceTable").innerHTML = `
    <table><thead><tr><th>인터페이스</th><th>타입</th><th>건수</th><th>성공</th><th>실패</th></tr></thead><tbody>${tableRows}</tbody></table>
  `;

  const pager = document.getElementById("interfacePager");
  pager.innerHTML = `
    <button class="secondary" id="interfacePagerPrev" ${page.page <= 1 ? "disabled" : ""}>이전</button>
    <span class="hint">페이지 ${page.page} / ${page.totalPages} (총 ${page.total}개 인터페이스)</span>
    <button class="secondary" id="interfacePagerNext" ${page.page >= page.totalPages ? "disabled" : ""}>다음</button>
  `;
  document.getElementById("interfacePagerPrev")?.addEventListener("click", () => {
    statsState.interfacePage = Math.max(1, statsState.interfacePage - 1);
    loadInterfaceStats();
  });
  document.getElementById("interfacePagerNext")?.addEventListener("click", () => {
    statsState.interfacePage += 1;
    loadInterfaceStats();
  });
}

async function loadDailyStats() {
  try {
    renderDailyChart(await api("GET", `/api/stats/daily?days=${statsState.dailyDays}`));
  } catch (err) {
    document.getElementById("dailyChart").innerHTML = `<p class="error">${err.message}</p>`;
  }
}
document.getElementById("dailyRefreshBtn").addEventListener("click", loadDailyStats);
document.querySelectorAll("#dailyRangeSelect .range-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#dailyRangeSelect .range-btn").forEach((b) => b.classList.toggle("active", b === btn));
    statsState.dailyDays = Number(btn.dataset.days);
    loadDailyStats();
  });
});

async function loadTypeStats() {
  try {
    renderTypeChart(await api("GET", "/api/stats/by-type?days=30"));
  } catch (err) {
    document.getElementById("typeChart").innerHTML = `<p class="error">${err.message}</p>`;
  }
}
document.getElementById("typeRefreshBtn").addEventListener("click", loadTypeStats);

async function loadInterfaceStats() {
  try {
    const params = new URLSearchParams({
      days: "30",
      page: String(statsState.interfacePage),
      pageSize: String(statsState.interfacePageSize),
    });
    if (statsState.interfaceSearch) params.set("search", statsState.interfaceSearch);
    renderInterfaceChart(await api("GET", `/api/stats/by-interface?${params}`));
  } catch (err) {
    document.getElementById("interfaceChart").innerHTML = `<p class="error">${err.message}</p>`;
  }
}
document.getElementById("interfaceRefreshBtn").addEventListener("click", loadInterfaceStats);

let interfaceSearchDebounce;
document.getElementById("interfaceSearchInput").addEventListener("input", (e) => {
  clearTimeout(interfaceSearchDebounce);
  interfaceSearchDebounce = setTimeout(() => {
    statsState.interfaceSearch = e.target.value;
    statsState.interfacePage = 1;
    loadInterfaceStats();
  }, 300);
});

// ---------- Chat ----------
function appendChatMessage(role, text, note) {
  const log = document.getElementById("chatLog");
  const el = document.createElement("div");
  el.className = `chat-msg ${role}`;
  el.textContent = text;
  if (note) {
    const noteEl = document.createElement("span");
    noteEl.className = "fallback-note";
    noteEl.textContent = note;
    el.appendChild(noteEl);
  }
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

async function sendChat() {
  const input = document.getElementById("chatInput");
  const question = input.value.trim();
  if (!question) return;
  input.value = "";
  appendChatMessage("user", question);
  const sendBtn = document.getElementById("chatSendBtn");
  sendBtn.disabled = true;
  try {
    const result = await api("POST", "/api/chat", { question });
    appendChatMessage("bot", result.answer, `(${result.range.label} 데이터 기준)`);
  } catch (err) {
    appendChatMessage("bot", `오류: ${err.message}`);
  } finally {
    sendBtn.disabled = false;
  }
}
document.getElementById("chatSendBtn").addEventListener("click", sendChat);
document.getElementById("chatInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChat();
});

// ---------- Init ----------
loadMonitoring();
