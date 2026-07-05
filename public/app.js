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

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

function activateTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tab}`));
}

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
