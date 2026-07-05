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

loadMonitoring();
