// AI Office — Background Service Worker
//
// Owns the transport to the local companion. Native Messaging is the primary
// channel; HTTP is kept as a fallback so existing dev setups keep working.
// The side panel never talks to the companion directly — it sends messages
// here via chrome.runtime.sendMessage.

const NATIVE_HOST = "com.aioffice.companion";
const DEFAULT_HTTP_URL = "http://127.0.0.1:7848";
const STATUS_POLL_MINUTES = 0.25; // 15s

const MODE_LABELS = {
  claude_desktop: "Claude Desktop is connected. Using your Claude subscription.",
  anthropic_api: "Using your Anthropic API key.",
  not_connected: "Install Claude Desktop to get started.",
};

let httpUrl = DEFAULT_HTTP_URL;
let status = {
  connected: false,
  transport: null,         // "native" | "http" | null
  mode: "not_connected",
  label: MODE_LABELS.not_connected,
  ready: false,
  version: null,
};

chrome.storage.local.get("server_url", (stored) => {
  if (stored.server_url) httpUrl = stored.server_url;
  refreshStatus();
});

chrome.alarms.create("status_poll", { periodInMinutes: STATUS_POLL_MINUTES });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "status_poll") refreshStatus();
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "get_status") {
    sendResponse({ ...status, httpUrl });
    return false;
  }
  if (msg.type === "refresh_status") {
    refreshStatus().then(() => sendResponse({ ...status }));
    return true;
  }
  if (msg.type === "set_http_url") {
    httpUrl = msg.url;
    chrome.storage.local.set({ server_url: httpUrl });
    refreshStatus();
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === "chat") {
    handleChat(msg.payload)
      .then((res) => sendResponse({ ok: true, ...res }))
      .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
    return true;
  }
  return false;
});

// ── Native Messaging ─────────────────────────────────────────────────────────
function nativeRequest(payload, timeoutMs = 130000) {
  return new Promise((resolve, reject) => {
    let port;
    try {
      port = chrome.runtime.connectNative(NATIVE_HOST);
    } catch (err) {
      reject(err);
      return;
    }
    let settled = false;
    const cleanup = () => { try { port && port.disconnect(); } catch {} };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Native host timeout"));
    }, timeoutMs);
    port.onMessage.addListener((response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(response);
    });
    port.onDisconnect.addListener(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const err = chrome.runtime.lastError;
      reject(new Error(err?.message || "Native host not available"));
    });
    try {
      port.postMessage(payload);
    } catch (err) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      reject(err);
    }
  });
}

// ── HTTP fallback ────────────────────────────────────────────────────────────
async function httpStatus() {
  const res = await fetch(`${httpUrl}/status`, { signal: AbortSignal.timeout(3000) });
  return await res.json();
}

async function httpChat(payload) {
  const res = await fetch(`${httpUrl}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

// ── Unified status + chat ────────────────────────────────────────────────────
async function refreshStatus() {
  // Try Native Messaging first
  try {
    const res = await nativeRequest({ type: "status" }, 4000);
    if (res && res.type === "status") {
      setStatus({
        connected: true,
        transport: "native",
        mode: res.mode,
        label: res.label || MODE_LABELS[res.mode] || res.mode,
        ready: !!res.ready,
        version: res.version || null,
      });
      return;
    }
  } catch { /* fall through */ }

  // Fall back to HTTP
  try {
    const res = await httpStatus();
    const mode = res.mode || "claude_desktop";
    setStatus({
      connected: true,
      transport: "http",
      mode,
      label: res.label || MODE_LABELS[mode] || mode,
      ready: res.ready !== false,
      version: res.version || null,
    });
    return;
  } catch { /* fall through */ }

  setStatus({
    connected: false,
    transport: null,
    mode: "not_connected",
    label: MODE_LABELS.not_connected,
    ready: false,
    version: null,
  });
}

function setStatus(next) {
  const changed =
    status.connected !== next.connected ||
    status.transport !== next.transport ||
    status.mode !== next.mode ||
    status.ready !== next.ready;
  Object.assign(status, next);
  chrome.action.setTitle({
    title: next.connected ? `AI Office: ${next.label}` : "AI Office: Disconnected",
  });
  if (changed) {
    chrome.runtime.sendMessage({ type: "status_update", ...status }).catch(() => {});
  }
}

async function handleChat(payload) {
  // Prefer the last working transport, fall back to the other on failure.
  const tryNative = async () => {
    const res = await nativeRequest({ type: "chat", ...payload });
    if (res && res.type === "chat") return { response: res.response, mode: res.mode };
    if (res && res.type === "error") throw new Error(res.error);
    throw new Error("Unexpected native host response");
  };
  const tryHttp = async () => {
    const res = await httpChat(payload);
    return { response: res.response, mode: res.mode };
  };

  const order = status.transport === "http"
    ? [tryHttp, tryNative]
    : [tryNative, tryHttp];

  let lastErr;
  for (const attempt of order) {
    try { return await attempt(); }
    catch (err) { lastErr = err; }
  }
  throw lastErr || new Error("No working transport");
}
