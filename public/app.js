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
document.querySelectorAll(".subtab-btn").forEach((btn) => {
  btn.addEventListener("click", () => activateSubtab(btn.dataset.subtab));
});

function activateSubtab(name) {
  document.querySelectorAll(".subtab-btn").forEach((b) => b.classList.toggle("active", b.dataset.subtab === name));
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
