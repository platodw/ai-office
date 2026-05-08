// AI Office — Side Panel
// Connects to a local Claude companion server and provides
// setup guidance + ongoing chat with the user's Claude instance.

const MAX_PAGE_CHARS = 40000;
const AI_OFFICE_URL_DEFAULT = "https://aioffice.app";

const DEFAULT_ACTIONS = [
  { label: "Summarize",    icon: "📝", prompt: "Summarize this page in 3-5 sentences." },
  { label: "Key Facts",    icon: "🔑", prompt: "What are the key facts or data points on this page?" },
  { label: "Main Point",   icon: "🎯", prompt: "What is the main argument or point being made on this page?" },
  { label: "Action Items", icon: "✅", prompt: "List any action items or next steps mentioned on this page." }
];

let serverUrl = "http://127.0.0.1:7848";
let webAppUrl = AI_OFFICE_URL_DEFAULT;
let accountToken = "";
let currentStep = null;
let guideSteps = [];
let userProfile = null;
let userQuestionnaire = null;
let pageContext = null;
let messages = [];
let companionStatus = { connected: false, mode: "not_connected", label: "Checking your setup…", ready: false, transport: null };

const NOT_CONNECTED_HINT =
  "Install Claude Code from claude.ai/download, then run the AI Office companion installer.";

// ── Telemetry (opt-in, scrubbed) ─────────────────────────────────────────────
// Anonymous so we can detect places where instructions confuse users. The
// session_id rotates daily and is not tied to the user account. Server-side
// is gated by profiles.allow_telemetry; if the user hasn't opted in the
// endpoint silently drops the call.
function scrubPrompt(text) {
  return String(text || "")
    .replace(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, "[email]")
    .replace(/\b\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[phone]")
    .replace(/\b[a-zA-Z0-9_-]{32,}\b/g, "[token]")
    .replace(/[A-Z]:\\[^\s"<>|]+/g, "[path]")
    .replace(/\/(?:home|Users)\/[^\s"<>|]+/g, "[path]");
}

function getDailySessionId() {
  const today = new Date().toISOString().slice(0, 10);
  const key = `telemetry_session_${today}`;
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `${today}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

function pageDomain(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}

function fireTelemetry({ stepId, prompt, url }) {
  if (!accountToken || !webAppUrl) return;
  fetch(`${webAppUrl}/api/telemetry?token=${encodeURIComponent(accountToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: getDailySessionId(),
      step_id: stepId || null,
      page_domain: pageDomain(url || ""),
      scrubbed_prompt: scrubPrompt(prompt),
    }),
    keepalive: true,
  }).catch(() => {});
}

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const stored = await chrome.storage.local.get(["server_url", "web_app_url", "account_token", "configured"]);
  if (stored.server_url) serverUrl = stored.server_url;
  if (stored.web_app_url) webAppUrl = stored.web_app_url;
  if (stored.account_token) accountToken = stored.account_token;

  if (stored.configured) {
    showChatScreen();
    await loadPageContext();
    await loadCurrentStep();
  } else {
    document.getElementById("server-url-input").value = serverUrl;
    document.getElementById("web-app-url-input").value = webAppUrl;
    if (stored.account_token) document.getElementById("account-token-input").value = stored.account_token;
    showSetupScreen();
  }

  document.getElementById("connect-btn").addEventListener("click", connect);
  document.getElementById("send-btn").addEventListener("click", sendMessage);
  document.getElementById("user-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById("clear-btn").addEventListener("click", clearChat);
  document.getElementById("reload-context-btn").addEventListener("click", async () => {
    pageContext = null;
    await loadPageContext();
  });
  document.getElementById("settings-btn").addEventListener("click", () => {
    document.getElementById("server-url-input").value = serverUrl;
    document.getElementById("web-app-url-input").value = webAppUrl;
    document.getElementById("account-token-input").value = accountToken;
    showSetupScreen();
  });
  document.getElementById("add-action-btn").addEventListener("click", toggleEditor);
  document.getElementById("close-editor-btn").addEventListener("click", toggleEditor);
  document.getElementById("save-action-btn").addEventListener("click", saveNewAction);
  document.getElementById("step-expand-btn").addEventListener("click", toggleStepDetail);
  document.getElementById("step-complete-btn").addEventListener("click", () => {
    if (currentStep) handleMarkComplete();
  });

  // Open links in a new tab via chrome.tabs.create (target=_blank in side panels is unreliable)
  document.getElementById("messages").addEventListener("click", (e) => {
    const a = e.target.closest("a[href^='http']");
    if (!a) return;
    e.preventDefault();
    chrome.tabs.create({ url: a.href });
  });

  chrome.runtime.sendMessage({ type: "get_status" }, (res) => {
    if (res) {
      if (res.httpUrl) serverUrl = res.httpUrl;
      applyStatus(res);
    }
  });
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "status_update") applyStatus(msg);
  });
  chrome.runtime.sendMessage({ type: "refresh_status" }).catch(() => {});

  chrome.tabs.onActivated.addListener(() => handleTabChange());
  chrome.tabs.onUpdated.addListener((id, info, tab) => {
    if (tab.active && info.status === "complete") handleTabChange();
  });

  await initActions();
});

let tabChangeTimer = null;
let lastNavUrl = null;
function handleTabChange() {
  clearTimeout(tabChangeTimer);
  tabChangeTimer = setTimeout(async () => {
    pageContext = null;
    document.getElementById("page-title").textContent = "Loading...";
    setFavicon(null);
    await loadPageContext();
    // Only inject a nav event when the URL actually changes (skip reloads/title flips)
    if (pageContext && pageContext.url !== lastNavUrl) {
      lastNavUrl = pageContext.url;
      messages.push({ role: "user", content: `[Navigated to: ${pageContext.title} — ${pageContext.url}]` });
      messages.push({ role: "assistant", content: `[Page updated to: ${pageContext.title}]` });
    }
  }, 500);
}

// ── Connection ────────────────────────────────────────────────────────────────
async function connect() {
  const urlVal = document.getElementById("server-url-input").value.trim();
  const webUrlVal = document.getElementById("web-app-url-input").value.trim();
  const tokenVal = document.getElementById("account-token-input").value.trim();
  if (urlVal && urlVal !== serverUrl) {
    serverUrl = urlVal;
    chrome.runtime.sendMessage({ type: "set_http_url", url: serverUrl });
  }
  if (webUrlVal) webAppUrl = webUrlVal.replace(/\/$/, "");
  if (tokenVal) accountToken = tokenVal;

  // Re-check status before continuing so we surface the latest state.
  const fresh = await new Promise((resolve) =>
    chrome.runtime.sendMessage({ type: "refresh_status" }, (res) => resolve(res || companionStatus))
  );
  applyStatus(fresh);

  if (!fresh.connected) {
    setSetupHint("Couldn't reach the AI Office companion. Install it, then click Continue.");
    return;
  }

  await chrome.storage.local.set({
    server_url: serverUrl,
    web_app_url: webAppUrl,
    account_token: accountToken,
    configured: true,
  });
  chrome.runtime.sendMessage({ type: "set_web_config", webAppUrl, accountToken }).catch(() => {});
  showChatScreen();
  await loadPageContext();
  await loadCurrentStep();
}

// ── Setup status banner ──────────────────────────────────────────────────────
function applyStatus(s) {
  if (!s) return;
  companionStatus = { ...companionStatus, ...s };
  updateMcpDot(s.connected);
  renderSetupStatus();
}

function renderSetupStatus() {
  const banner = document.getElementById("setup-status");
  const text = document.getElementById("setup-status-text");
  if (!banner || !text) return;
  let state = "checking";
  let hint = "";

  if (!companionStatus.connected) {
    state = "error";
    hint = NOT_CONNECTED_HINT;
  } else if (companionStatus.mode === "claude_desktop") {
    state = "ready";
  } else if (companionStatus.mode === "anthropic_api") {
    state = companionStatus.ready ? "ready" : "warning";
  } else if (companionStatus.mode === "not_connected") {
    state = "warning";
    hint = NOT_CONNECTED_HINT;
  }

  banner.dataset.state = state;
  text.textContent = companionStatus.label || "Checking your setup…";
  setSetupHint(hint);
}

function setSetupHint(text) {
  const el = document.getElementById("setup-status-hint");
  if (!el) return;
  if (text) {
    el.textContent = text;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

// ── Screen Management ─────────────────────────────────────────────────────────
function showSetupScreen() {
  document.getElementById("setup-screen").classList.remove("hidden");
  document.getElementById("chat-screen").classList.add("hidden");
}
function showChatScreen() {
  document.getElementById("setup-screen").classList.add("hidden");
  document.getElementById("chat-screen").classList.remove("hidden");
}

// ── Page Context ──────────────────────────────────────────────────────────────
function setFavicon(url) {
  const img = document.getElementById("page-favicon");
  if (!img) return;
  if (!url) { img.src = ""; img.classList.add("hidden"); return; }
  img.src = url;
  img.classList.remove("hidden");
  img.onerror = () => img.classList.add("hidden");
}

async function loadPageContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    const titleEl = document.getElementById("page-title");
    if (titleEl) titleEl.textContent = tab.title || tab.url || "Unknown";
    const faviconUrl = tab.favIconUrl || null;
    setFavicon(faviconUrl);
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ url: location.href, title: document.title, text: document.body?.innerText?.slice(0, 40000) || "" }),
    });
    if (results?.[0]?.result) {
      pageContext = results[0].result;
      if (titleEl) titleEl.textContent = pageContext.title || tab.url;
    } else {
      pageContext = { url: tab.url, title: tab.title || tab.url, text: "" };
    }
  } catch {
    pageContext = null;
  }
}

// ── Step Guidance ─────────────────────────────────────────────────────────────
async function loadCurrentStep() {
  if (!accountToken || !webAppUrl) return;
  try {
    const res = await fetch(`${webAppUrl}/api/extension/status?token=${encodeURIComponent(accountToken)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.connected) return;
    currentStep = data.current_step || null;
    guideSteps = data.all_steps || [];
    userProfile = data.profile || null;
    userQuestionnaire = data.questionnaire || null;
    renderStep();
  } catch {
    // silently fail — step guidance is best-effort
  }
}

const MARK_COMPLETE_PATTERN = /\b(done|complete|completed|finished|mark.*(complete|done)|next step)\b/i;

async function handleMarkComplete() {
  if (!currentStep || !accountToken || !webAppUrl) return;
  try {
    await fetch(`${webAppUrl}/api/steps/${currentStep.id}?token=${encodeURIComponent(accountToken)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "complete" }),
    });
    await loadCurrentStep();
  } catch {}
}

// ── Step pill + detail panel ──────────────────────────────────────────────────
let stepDetailOpen = false;

function renderStep() {
  const pill = document.getElementById("step-pill");
  const bar = document.getElementById("step-bar");
  const title = document.getElementById("step-title");
  const completeBtn = document.getElementById("step-complete-btn");

  if (!currentStep) {
    if (bar) bar.classList.add("hidden");
    return;
  }

  if (bar) bar.classList.remove("hidden");
  if (title) title.textContent = `Step ${currentStep.step_number}: ${currentStep.title}`;
  if (pill) {
    pill.textContent = `${currentStep.step_number}`;
    pill.title = currentStep.title;
  }
  if (completeBtn) {
    completeBtn.title = "Mark step complete";
  }

  if (stepDetailOpen) renderStepDetail();
}

function toggleStepDetail() {
  stepDetailOpen = !stepDetailOpen;
  const btn = document.getElementById("step-expand-btn");
  const detail = document.getElementById("step-detail");
  if (btn) btn.dataset.open = stepDetailOpen ? "true" : "false";
  if (detail) {
    if (stepDetailOpen) {
      detail.classList.remove("hidden");
      renderStepDetail();
    } else {
      detail.classList.add("hidden");
    }
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderStepDetail() {
  const detail = document.getElementById("step-detail");
  if (!detail || !currentStep) return;

  const parts = [];

  if (currentStep.why) {
    parts.push(`<p class="step-detail-why">${escapeHtml(currentStep.why)}</p>`);
  }

  if (currentStep.click_steps?.length) {
    parts.push(
      `<ol class="step-detail-list">${currentStep.click_steps.map(s =>
        `<li>${escapeHtml(s)}</li>`
      ).join("")}</ol>`
    );
  }

  if (currentStep.code_blocks?.length) {
    parts.push(currentStep.code_blocks.map(b =>
      `<pre class="step-detail-code"><code>${escapeHtml(b.content || b)}</code></pre>`
    ).join(""));
  }

  if (currentStep.notes?.length) {
    parts.push(
      `<ul class="step-detail-notes">${currentStep.notes.map(n =>
        `<li>${escapeHtml(n)}</li>`
      ).join("")}</ul>`
    );
  }

  if (currentStep.links?.length) {
    parts.push(
      `<div class="step-detail-links">${currentStep.links.map(l =>
        `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a>`
      ).join("")}</div>`
    );
  }

  detail.innerHTML = parts.join("") || "<p>No additional details.</p>";
}

// ── Actions ───────────────────────────────────────────────────────────────────
let customActions = [];

async function initActions() {
  const stored = await chrome.storage.local.get("custom_actions");
  customActions = stored.custom_actions || [];
  renderActions();
}

function renderActions() {
  const container = document.getElementById("quick-actions");
  if (!container) return;
  const all = [...DEFAULT_ACTIONS, ...customActions];
  container.innerHTML = all.map((a, i) =>
    `<button class="action-btn" data-index="${i}" title="${escapeHtml(a.label)}">${a.icon || "⚡"}</button>`
  ).join("");
  container.querySelectorAll(".action-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = all[parseInt(btn.dataset.index)];
      if (action) triggerAction(action.prompt);
    });
  });
}

function triggerAction(prompt) {
  const input = document.getElementById("user-input");
  if (!input) return;
  input.value = prompt;
  sendMessage();
}

function toggleEditor() {
  const editor = document.getElementById("action-editor");
  if (!editor) return;
  editor.classList.toggle("hidden");
  if (!editor.classList.contains("hidden")) {
    document.getElementById("action-label-input").value = "";
    document.getElementById("action-icon-input").value = "";
    document.getElementById("action-prompt-input").value = "";
  }
}

async function saveNewAction() {
  const label = document.getElementById("action-label-input").value.trim();
  const icon = document.getElementById("action-icon-input").value.trim() || "⚡";
  const prompt = document.getElementById("action-prompt-input").value.trim();
  if (!label || !prompt) return;
  customActions.push({ label, icon, prompt });
  await chrome.storage.local.set({ custom_actions: customActions });
  renderActions();
  toggleEditor();
}

// ── MCP Status Dot ────────────────────────────────────────────────────────────
function updateMcpDot(connected) {
  const dot = document.getElementById("mcp-status-dot");
  if (!dot) return;
  dot.dataset.connected = connected ? "true" : "false";
  dot.title = connected
    ? "Connected to Claude Desktop"
    : "Not connected to Claude Desktop";
}

// ── Clear chat ────────────────────────────────────────────────────────────────
function clearChat() {
  messages = [];
  const container = document.getElementById("messages");
  if (container) container.innerHTML = "";
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function renderMarkdown(text) {
  let html = escapeHtml(text);
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Numbered list
  html = html.replace(/(?:^|\n)(\d+)\.\s+(.+)/g, (_, n, item) => `\n<li value="${n}">${item}</li>`);
  html = html.replace(/(<li[^>]*>.*<\/li>)/s, "<ol>$1</ol>");
  // Bullet list
  html = html.replace(/(?:^|\n)[-*]\s+(.+)/g, (_, item) => `\n<li>${item}</li>`);
  html = html.replace(/(?<!\<ol\>)(<li>.*<\/li>)(?!\<\/ol\>)/s, "<ul>$1</ul>");
  // Paragraphs
  html = html.replace(/\n\n+/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");
  return `<p>${html}</p>`;
}

// ── Message rendering ─────────────────────────────────────────────────────────
function appendMessage(role, text) {
  const container = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = `message ${role}`;
  if (role === "thinking") {
    div.textContent = text;
  } else if (role === "assistant") {
    div.innerHTML = renderMarkdown(text);
  } else {
    div.textContent = text;
  }
  container.appendChild(div);
  div.scrollIntoView({ behavior: "smooth", block: "end" });
  return div;
}

// ── Chat ──────────────────────────────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById("user-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  if (!pageContext) await loadPageContext();

  appendMessage("user", text);
  messages.push({ role: "user", content: text });

  // Anonymous telemetry — only sent if the user has opted in server-side.
  fireTelemetry({
    stepId: currentStep?.id,
    prompt: text,
    url: pageContext?.url,
  });

  // Intent: mark current step complete
  if (MARK_COMPLETE_PATTERN.test(text) && currentStep) {
    await handleMarkComplete();
    return;
  }

  const sendBtn = document.getElementById("send-btn");
  sendBtn.disabled = true;
  const thinkingEl = appendMessage("thinking", "Thinking...");

  const stepContext = currentStep
    ? {
        id: currentStep.id,
        title: currentStep.title,
        description: currentStep.description,
        why: currentStep.why,
        click_steps: currentStep.click_steps,
        code_blocks: currentStep.code_blocks,
        notes: currentStep.notes,
      }
    : null;

  // Replace the static "Thinking..." with a live elapsed-time indicator + Cancel.
  thinkingEl.remove();
  const port = chrome.runtime.connect({ name: "chat" });
  let cancelledByUser = false;

  const { container: progressEl, setElapsed, showCancel } = appendThinkingProgress(() => {
    cancelledByUser = true;
    try { port.postMessage({ type: "cancel" }); } catch {}
  });

  let assistantEl = null;
  let assistantText = "";
  const startTs = Date.now();
  const tick = setInterval(() => {
    const secs = Math.round((Date.now() - startTs) / 1000);
    setElapsed(secs);
    if (secs >= 5) showCancel();
  }, 500);

  function ensureAssistantEl() {
    if (assistantEl) return assistantEl;
    progressEl.remove();
    clearInterval(tick);
    assistantEl = appendMessage("assistant", "");
    return assistantEl;
  }

  function finish({ error } = {}) {
    clearInterval(tick);
    try { port.disconnect(); } catch {}
    if (assistantEl && assistantText) {
      messages.push({ role: "assistant", content: assistantText });
    }
    if (error && !assistantEl) {
      progressEl.remove();
      appendMessage("error", error);
    } else if (error && assistantEl) {
      const note = document.createElement("div");
      note.className = "message error";
      note.textContent = error;
      assistantEl.parentNode.appendChild(note);
    }
    sendBtn.disabled = false;
  }

  port.onMessage.addListener((m) => {
    if (m.type === "chunk") {
      ensureAssistantEl();
      assistantText += m.text;
      assistantEl.innerHTML = renderMarkdown(assistantText);
      assistantEl.scrollIntoView({ behavior: "smooth", block: "end" });
    } else if (m.type === "done") {
      finish();
    } else if (m.type === "cancelled") {
      finish({ error: "Cancelled." });
    } else if (m.type === "error") {
      finish({ error: m.error || "Something went wrong." });
    }
  });

  port.onDisconnect.addListener(() => {
    if (!cancelledByUser) finish({ error: "Lost connection to the companion." });
  });

  port.postMessage({
    type: "chat",
    payload: {
      message: text,
      page_context: pageContext,
      history: messages.slice(-10),
      current_step: stepContext,
      guide_steps: guideSteps,
      user_profile: userProfile,
      user_questionnaire: userQuestionnaire,
    },
  });
}

// Renders the in-place "Thinking… 12s [Cancel]" indicator that replaces the
// static dots while a chat is streaming.
function appendThinkingProgress(onCancel) {
  const container = document.createElement("div");
  container.className = "message thinking";

  const label = document.createElement("span");
  label.textContent = "Thinking…";
  container.appendChild(label);

  let cancelBtn = null;
  function showCancel() {
    if (cancelBtn) return;
    cancelBtn = document.createElement("button");
    cancelBtn.className = "cancel-btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      cancelBtn.disabled = true;
      onCancel();
    });
    container.appendChild(cancelBtn);
  }

  function setElapsed(secs) {
    label.textContent = `Thinking… ${secs}s`;
  }

  const messagesEl = document.getElementById("messages");
  messagesEl.appendChild(container);
  container.scrollIntoView({ behavior: "smooth", block: "end" });

  return { container, setElapsed, showCancel };
}
