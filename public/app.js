const state = {
  flows: [],
  selectedFlowId: null,
  lastRoutingCondition: null,
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

function parseJsonField(value, fieldLabel, { optional = false } = {}) {
  const trimmed = value.trim();
  if (!trimmed) {
    if (optional) return undefined;
    throw new Error(`${fieldLabel}는 필수입니다.`);
  }
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    throw new Error(`${fieldLabel} JSON 파싱 실패: ${err.message}`);
  }
}

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// ---------- Health ----------
async function refreshHealth() {
  const badge = document.getElementById("ollamaStatus");
  try {
    const health = await api("GET", "/health");
    badge.textContent = health.ollamaReachable ? "Ollama 연결됨" : "Ollama 꺼짐 (로컬 AI 비활성)";
    badge.className = "badge " + (health.ollamaReachable ? "badge-ok" : "badge-down");
  } catch {
    badge.textContent = "상태 확인 실패";
    badge.className = "badge badge-down";
  }
}

// ---------- Flows ----------
function webhookUrlFor(flow) {
  if (flow.source.type !== "memory") return null;
  return `${window.location.origin}/webhook/${flow.source.queue}`;
}

function renderFlowList() {
  const container = document.getElementById("flowList");
  if (state.flows.length === 0) {
    container.innerHTML = '<p class="hint">등록된 Flow가 없습니다.</p>';
    return;
  }
  container.innerHTML = "";
  for (const flow of state.flows) {
    const item = document.createElement("div");
    item.className = "flow-item";
    const webhookUrl = webhookUrlFor(flow);
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(flow.name)}</strong>
        <div class="meta">
          ${flow.source.type} → ${flow.destination.type}
          ${flow.routing ? '<span class="tag">routing</span>' : ""}
          ${flow.mapping && flow.mapping.length ? '<span class="tag">mapping</span>' : ""}
        </div>
        ${webhookUrl ? `<div class="meta">webhook: <span class="webhook-url">${webhookUrl}</span></div>` : ""}
      </div>
      <div class="actions"></div>
    `;
    const actions = item.querySelector(".actions");

    const viewBtn = document.createElement("button");
    viewBtn.className = "secondary";
    viewBtn.textContent = "상세";
    viewBtn.onclick = (e) => {
      e.stopPropagation();
      showFlowDetail(flow.id);
    };

    const runBtn = document.createElement("button");
    runBtn.textContent = "실행";
    runBtn.onclick = async (e) => {
      e.stopPropagation();
      runBtn.disabled = true;
      try {
        const result = await api("POST", `/api/flows/${flow.id}/run`);
        await showFlowDetail(flow.id, result);
      } catch (err) {
        alert(`실행 실패: ${err.message}`);
      } finally {
        runBtn.disabled = false;
      }
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "danger";
    deleteBtn.textContent = "삭제";
    deleteBtn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`'${flow.name}' Flow를 삭제할까요?`)) return;
      await api("DELETE", `/api/flows/${flow.id}`);
      if (state.selectedFlowId === flow.id) {
        document.getElementById("flowDetail").hidden = true;
        state.selectedFlowId = null;
      }
      await loadFlows();
    };

    actions.append(viewBtn, runBtn, deleteBtn);
    item.addEventListener("click", () => showFlowDetail(flow.id));
    container.appendChild(item);
  }
}

async function loadFlows() {
  state.flows = await api("GET", "/api/flows");
  renderFlowList();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function showFlowDetail(flowId, latestRunResult) {
  state.selectedFlowId = flowId;
  const flow = state.flows.find((f) => f.id === flowId) ?? (await api("GET", `/api/flows/${flowId}`));
  const detail = document.getElementById("flowDetail");
  const title = document.getElementById("flowDetailTitle");
  const body = document.getElementById("flowDetailBody");
  detail.hidden = false;
  title.textContent = `Flow 상세: ${flow.name}`;

  const [history, anomalies] = await Promise.all([
    api("GET", `/api/metrics/${flowId}`),
    api("GET", `/api/metrics/${flowId}/anomalies?explain=true`),
  ]);

  const rows = history
    .slice(-10)
    .reverse()
    .map(
      (m) => `<tr>
        <td>${new Date(m.timestamp).toLocaleString()}</td>
        <td>${m.durationMs}ms</td>
        <td>${m.received}</td>
        <td>${m.success}</td>
        <td>${m.failed}</td>
        <td>${m.filtered ?? 0}</td>
      </tr>`,
    )
    .join("");

  const anomalyHtml = anomalies.length
    ? anomalies
        .map(
          (a) => `<div class="error">⚠ [${a.metric}] ${a.explanation ?? `평균 ${a.mean.toFixed(2)} 대비 ${a.latestValue.toFixed(2)}`}</div>`,
        )
        .join("")
    : '<p class="hint">최근 이상 없음</p>';

  const webhookUrl = webhookUrlFor(flow);

  body.innerHTML = `
    <pre class="result">${escapeHtml(JSON.stringify(flow, null, 2))}</pre>
    ${
      webhookUrl
        ? `<p class="hint">실시간 수신 예시:</p><pre class="result">curl -X POST ${webhookUrl} -H 'content-type: application/json' -d '{"...": "..."}'</pre>`
        : ""
    }
    ${latestRunResult ? `<h3>방금 실행 결과</h3><pre class="result">${escapeHtml(JSON.stringify(latestRunResult, null, 2))}</pre>` : ""}
    <h3>최근 실행 이력</h3>
    <table>
      <thead><tr><th>시각</th><th>소요</th><th>수신</th><th>성공</th><th>실패</th><th>필터링</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" class="hint">실행 이력 없음</td></tr>'}</tbody>
    </table>
    <h3>이상탐지</h3>
    ${anomalyHtml}
  `;
}

document.getElementById("flowForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById("flowFormError");
  errorBox.textContent = "";
  const form = new FormData(e.target);
  try {
    const payload = {
      name: form.get("name").trim(),
      source: parseJsonField(form.get("source"), "소스 커넥터"),
      destination: parseJsonField(form.get("destination"), "목적지 커넥터"),
      mapping: parseJsonField(form.get("mapping"), "매핑 규칙", { optional: true }),
      routing: parseJsonField(form.get("routing"), "라우팅 규칙", { optional: true }),
    };
    await api("POST", "/api/flows", payload);
    e.target.reset();
    await loadFlows();
  } catch (err) {
    errorBox.textContent = err.message;
  }
});

// ---------- AI Mapping ----------
document.getElementById("mappingGenerateBtn").addEventListener("click", async () => {
  const errorBox = document.getElementById("mappingError");
  const resultBox = document.getElementById("mappingResult");
  errorBox.textContent = "";
  resultBox.hidden = true;
  try {
    const sourceSample = parseJsonField(document.getElementById("mappingSource").value, "소스 샘플");
    const targetSample = parseJsonField(document.getElementById("mappingTarget").value, "타겟 샘플");
    const { mapping } = await api("POST", "/api/mapping/generate", { sourceSample, targetSample });
    resultBox.textContent = JSON.stringify(mapping, null, 2);
    resultBox.hidden = false;
  } catch (err) {
    errorBox.textContent = err.message;
  }
});

// ---------- Routing ----------
document.getElementById("routingGenerateBtn").addEventListener("click", async () => {
  const errorBox = document.getElementById("routingError");
  const resultBox = document.getElementById("routingResult");
  errorBox.textContent = "";
  resultBox.hidden = true;
  document.getElementById("routingPreviewBtn").disabled = true;
  try {
    const sample = parseJsonField(document.getElementById("routingSample").value, "샘플 페이로드");
    const description = document.getElementById("routingDescription").value.trim();
    if (!description) throw new Error("자연어 조건을 입력하세요.");
    const { routing } = await api("POST", "/api/routing/generate", { sample, description });
    state.lastRoutingCondition = routing;
    resultBox.textContent = JSON.stringify(routing, null, 2);
    resultBox.hidden = false;
    document.getElementById("routingPreviewBtn").disabled = false;
  } catch (err) {
    errorBox.textContent = err.message;
  }
});

document.getElementById("routingPreviewBtn").addEventListener("click", async () => {
  const previewBox = document.getElementById("routingPreviewResult");
  previewBox.textContent = "";
  try {
    const sample = parseJsonField(document.getElementById("routingSample").value, "샘플 페이로드");
    const { matches } = await api("POST", "/api/routing/preview", { sample, routing: state.lastRoutingCondition });
    previewBox.innerHTML = matches
      ? '<span class="tag" style="color:var(--success);border-color:var(--success)">✓ 이 샘플은 통과합니다</span>'
      : '<span class="tag tag-anomaly">✗ 이 샘플은 필터링(차단)됩니다</span>';
  } catch (err) {
    previewBox.innerHTML = `<span class="error">${err.message}</span>`;
  }
});

// ---------- Anomalies ----------
async function loadAnomalies() {
  const list = document.getElementById("anomaliesList");
  list.textContent = "불러오는 중…";
  try {
    const [flows, anomalyGroups] = await Promise.all([api("GET", "/api/flows"), api("GET", "/api/anomalies")]);
    const nameOf = (id) => flows.find((f) => f.id === id)?.name ?? id;
    if (anomalyGroups.length === 0) {
      list.innerHTML = '<p class="hint">현재 이상 탐지된 Flow가 없습니다.</p>';
      return;
    }
    list.innerHTML = anomalyGroups
      .map(
        (group) => `
      <div class="card">
        <strong>${escapeHtml(nameOf(group.flowId))}</strong>
        ${group.anomalies
          .map((a) => `<div class="error">⚠ [${a.metric}] 평균 ${a.mean.toFixed(2)} → 현재 ${a.latestValue.toFixed(2)} (z=${a.zScore === Infinity ? "∞" : a.zScore.toFixed(2)})</div>`)
          .join("")}
      </div>`,
      )
      .join("");
  } catch (err) {
    list.innerHTML = `<p class="error">${err.message}</p>`;
  }
}
document.getElementById("anomaliesRefreshBtn").addEventListener("click", loadAnomalies);

// ---------- Init ----------
refreshHealth();
loadFlows();
setInterval(refreshHealth, 15000);
