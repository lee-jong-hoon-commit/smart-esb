const state = {
  flows: [],
  templates: [],
  selectedFlowId: null,
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

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

function activateTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tab}`));
  if (tab === "monitoring") loadMonitoring();
}

// ---------- Health ----------
async function refreshHealth() {
  const badge = document.getElementById("ollamaStatus");
  const scheduleBadge = document.getElementById("scheduleStatus");
  try {
    const health = await api("GET", "/health");
    badge.textContent = health.ollamaReachable ? "Ollama 연결됨" : "Ollama 꺼짐 (로컬 AI 비활성)";
    badge.className = "badge " + (health.ollamaReachable ? "badge-ok" : "badge-down");
    scheduleBadge.textContent = `활성 스케줄 ${health.activeSchedules}개`;
    scheduleBadge.className = "badge badge-unknown";
  } catch {
    badge.textContent = "상태 확인 실패";
    badge.className = "badge badge-down";
  }
}

// ---------- Templates ----------
async function loadTemplates() {
  const container = document.getElementById("templateList");
  state.templates = await api("GET", "/api/templates");
  container.innerHTML = "";
  for (const t of state.templates) {
    const card = document.createElement("div");
    card.className = "template-card";
    card.innerHTML = `
      <span class="category">${escapeHtml(t.category)}</span>
      <h3>${escapeHtml(t.name)}</h3>
      <p>${escapeHtml(t.scenario)}</p>
      <div class="notes">${escapeHtml(t.notes)}</div>
    `;
    const btn = document.createElement("button");
    btn.textContent = "이 템플릿으로 Flow 만들기";
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        await api("POST", `/api/templates/${t.id}/instantiate`, {});
        await loadFlows();
        activateTab("flows");
      } catch (err) {
        alert(`Flow 생성 실패: ${err.message}`);
      } finally {
        btn.disabled = false;
      }
    };
    card.appendChild(btn);
    container.appendChild(card);
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
    container.innerHTML = '<p class="hint">등록된 Flow가 없습니다. 템플릿 탭에서 만들어보세요.</p>';
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
          ${flow.schedule ? `<span class="tag">schedule: ${escapeHtml(flow.schedule)}</span>` : ""}
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

function runRowsHtml(runs) {
  if (runs.length === 0) return '<tr><td colspan="6" class="hint">실행 이력 없음</td></tr>';
  return runs
    .map(
      (r) => `<tr>
        <td>${new Date(r.timestamp).toLocaleString()}</td>
        <td>${r.durationMs}ms</td>
        <td>${r.received}</td>
        <td>${r.success}</td>
        <td>${r.failed}</td>
        <td>${r.errors && r.errors.length ? `<span class="error">${escapeHtml(r.errors.join("; "))}</span>` : "-"}</td>
      </tr>`,
    )
    .join("");
}

async function showFlowDetail(flowId, latestRunResult) {
  state.selectedFlowId = flowId;
  const flow = state.flows.find((f) => f.id === flowId) ?? (await api("GET", `/api/flows/${flowId}`));
  const detail = document.getElementById("flowDetail");
  const title = document.getElementById("flowDetailTitle");
  const body = document.getElementById("flowDetailBody");
  detail.hidden = false;
  title.textContent = `Flow 상세: ${flow.name}`;

  const runs = await api("GET", `/api/monitoring/runs?flowId=${flowId}&limit=10`);
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
      <thead><tr><th>시각</th><th>소요</th><th>수신</th><th>성공</th><th>실패</th><th>에러</th></tr></thead>
      <tbody>${runRowsHtml(runs.slice().reverse())}</tbody>
    </table>
  `;
}

document.getElementById("flowForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById("flowFormError");
  errorBox.textContent = "";
  const form = new FormData(e.target);
  try {
    const schedule = form.get("schedule").trim();
    const payload = {
      name: form.get("name").trim(),
      source: parseJsonField(form.get("source"), "소스 커넥터"),
      destination: parseJsonField(form.get("destination"), "목적지 커넥터"),
      mapping: parseJsonField(form.get("mapping"), "매핑 규칙", { optional: true }),
      schedule: schedule || undefined,
    };
    await api("POST", "/api/flows", payload);
    e.target.reset();
    await loadFlows();
  } catch (err) {
    errorBox.textContent = err.message;
  }
});

// ---------- Monitoring ----------
async function loadMonitoring() {
  const container = document.getElementById("monitoringTable");
  container.innerHTML = '<p class="hint">불러오는 중…</p>';
  try {
    const runs = await api("GET", "/api/monitoring/runs?limit=50");
    if (runs.length === 0) {
      container.innerHTML = '<p class="hint">실행 이력이 없습니다.</p>';
      return;
    }
    const rows = runs
      .map(
        (r) => `<tr>
          <td>${new Date(r.timestamp).toLocaleString()}</td>
          <td>${escapeHtml(r.flowName)}</td>
          <td>${r.durationMs}ms</td>
          <td>${r.received}</td>
          <td>${r.failed > 0 ? `<span class="tag tag-fail">실패 ${r.failed}</span>` : '<span class="tag tag-ok">성공</span>'}</td>
          <td>${r.errors && r.errors.length ? `<span class="error">${escapeHtml(r.errors.join("; "))}</span>` : "-"}</td>
        </tr>`,
      )
      .join("");
    container.innerHTML = `
      <table>
        <thead><tr><th>시각</th><th>Flow</th><th>소요</th><th>수신</th><th>결과</th><th>에러</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}
document.getElementById("monitoringRefreshBtn").addEventListener("click", loadMonitoring);

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
    appendChatMessage(
      "bot",
      result.answer,
      result.aiUsed ? `(${result.range.label} 데이터 기준, AI 응답)` : `(${result.range.label} 데이터 기준, Ollama 없음 → 통계 요약)`,
    );
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
refreshHealth();
loadTemplates();
loadFlows();
setInterval(refreshHealth, 15000);
