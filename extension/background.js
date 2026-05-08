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
let webAppUrl = "";
let accountToken = "";
let status = {
  connected: false,
  transport: null,         // "native" | "http" | null
  mode: "not_connected",
  label: MODE_LABELS.not_connected,
  ready: false,
  version: null,
};

chrome.storage.local.get(["server_url", "web_app_url", "account_token"], (stored) => {
  if (stored.server_url) httpUrl = stored.server_url;
  if (stored.web_app_url) webAppUrl = stored.web_app_url.replace(/\/$/, "");
  if (stored.account_token) accountToken = stored.account_token;
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
  if (msg.type === "set_web_config") {
    if (msg.webAppUrl) webAppUrl = msg.webAppUrl.replace(/\/$/, "");
    if (msg.accountToken) accountToken = msg.accountToken;
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

// ── Streaming chat (long-lived port) ─────────────────────────────────────────
// Side panel opens a port named "chat" per turn. Priority order:
//   1. Vercel cloud endpoint (fast, always available, uses server-side API key)
//   2. Native Messaging (local companion, streams)
//   3. HTTP companion fallback (local, blocking)
chrome.runtime.onConnect.addListener((sidePanelPort) => {
  if (sidePanelPort.name !== "chat") return;
  let nativePort = null;
  let cloudAbort = null;
  let httpAbort = null;
  let cancelled = false;

  const cleanup = () => {
    cancelled = true;
    if (nativePort) { try { nativePort.disconnect(); } catch {} nativePort = null; }
    if (cloudAbort) { try { cloudAbort.abort(); } catch {} cloudAbort = null; }
    if (httpAbort) { try { httpAbort.abort(); } catch {} httpAbort = null; }
  };

  sidePanelPort.onDisconnect.addListener(cleanup);

  function safePost(p) {
    if (cancelled) return;
    try { sidePanelPort.postMessage(p); } catch {}
  }

  sidePanelPort.onMessage.addListener(async (msg) => {
    if (msg.type === "cancel") {
      if (nativePort) { try { nativePort.postMessage({ type: "cancel" }); } catch {} }
      try { sidePanelPort.postMessage({ type: "cancelled" }); } catch {}
      cleanup();
      return;
    }
    if (msg.type !== "chat") return;

    // 1. Try cloud endpoint first (fast, streaming SSE)
    if (webAppUrl && accountToken) {
      try {
        await streamViaCloud(msg.payload);
        return;
      } catch {
        if (cancelled) return;
        // fall through to local companion
      }
    }

    // 2. Try Native Messaging
    if (status.transport === "native" || status.transport === null) {
      try {
        await streamViaNative(msg.payload);
        return;
      } catch {
        if (cancelled) return;
      }
    }

    // 3. HTTP fallback
    await streamViaHttp(msg.payload);
  });

  async function streamViaCloud(payload) {
    cloudAbort = new AbortController();
    const url = `${webAppUrl}/api/extension/chat?token=${encodeURIComponent(accountToken)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: cloudAbort.signal,
    });
    if (!res.ok) throw new Error(`Cloud chat HTTP ${res.status}`);
    if (!res.body) throw new Error("No response body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (cancelled) { reader.cancel(); break; }
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const evt = JSON.parse(line.slice(6));
          if (evt.type === "chunk") safePost({ type: "chunk", text: evt.text });
          else if (evt.type === "done") { safePost({ type: "done", mode: "anthropic_api" }); return; }
          else if (evt.type === "error") throw new Error(evt.error);
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
    safePost({ type: "done", mode: "anthropic_api" });
  }

  function streamViaNative(payload) {
    return new Promise((resolve, reject) => {
      let port;
      try { port = chrome.runtime.connectNative(NATIVE_HOST); }
      catch (err) { reject(err); return; }
      nativePort = port;
      let settled = false;
      const settle = (fn) => { if (!settled) { settled = true; fn(); } };

      port.onMessage.addListener((m) => {
        if (cancelled) return;
        if (m.type === "chat_chunk") safePost({ type: "chunk", text: m.text });
        else if (m.type === "chat_done") {
          safePost({ type: "done", mode: m.mode });
          settle(resolve);
          try { port.disconnect(); } catch {}
        } else if (m.type === "chat_error") {
          safePost({ type: "error", error: m.error });
          settle(resolve);
          try { port.disconnect(); } catch {}
        }
      });
      port.onDisconnect.addListener(() => {
        const err = chrome.runtime.lastError;
        if (!settled) {
          if (err && err.message) settle(() => reject(new Error(err.message)));
          else { safePost({ type: "error", error: "Companion disconnected" }); settle(resolve); }
        }
      });

      try { port.postMessage({ type: "chat", ...payload }); }
      catch (err) { settle(() => reject(err)); }
    });
  }

  async function streamViaHttp(payload) {
    httpAbort = new AbortController();
    try {
      const res = await fetch(`${httpUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: httpAbort.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (cancelled) return;
      if (data.response) safePost({ type: "chunk", text: data.response });
      safePost({ type: "done", mode: data.mode || "claude_desktop" });
    } catch (err) {
      if (cancelled) return;
      const m = (err && err.message) || String(err);
      safePost({ type: "error", error: `Could not reach companion: ${m}` });
    } finally {
      httpAbort = null;
    }
  }
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

// handleChat removed — chat now flows through the streaming port handler
// above. nativeRequest is still used by refreshStatus().
