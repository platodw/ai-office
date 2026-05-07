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
  const el = document.getElementById("page-favicon");
  if (!el) return;
  if (url) { el.src = url; el.style.display = "block"; }
  else { el.src = ""; el.style.display = "none"; }
}

async function loadPageContext() {
  const titleEl = document.getElementById("page-title");
  titleEl.textContent = "Reading page...";
  setFavicon(null);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { titleEl.textContent = "No active tab"; return; }
    setFavicon(tab.favIconUrl || null);
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const url = location.href;
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll("script,style,nav,footer,aside").forEach(el => el.remove());
        const text = (clone.innerText || "").replace(/\s{3,}/g, "\n\n").trim();
        return { title: document.title, url, text };
      }
    });
    const data = results[0]?.result;
    if (!data) { titleEl.textContent = "Could not read page"; return; }
    pageContext = { title: data.title, url: data.url, text: data.text.slice(0, MAX_PAGE_CHARS) };
    titleEl.textContent = data.title || data.url;
    titleEl.title = data.url;
  } catch (err) {
    titleEl.textContent = "Error reading page";
  }
}

// ── Setup Step Context ────────────────────────────────────────────────────────
async function loadCurrentStep() {
  if (!accountToken) return;
  try {
    const res = await fetch(`${webAppUrl}/api/extension/status?token=${accountToken}`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return;
    const data = await res.json();
    currentStep = data.current_step ?? null;
    guideSteps = data.all_steps ?? [];
    userProfile = data.profile ?? null;
    userQuestionnaire = data.questionnaire ?? null;
    renderCurrentStep();
  } catch { /* non-fatal */ }
}

function renderCurrentStep() {
  const bar = document.getElementById("step-bar");
  const titleEl = document.getElementById("step-bar-title");
  const detail = document.getElementById("step-detail");
  const detailBody = document.getElementById("step-detail-body");
  if (!bar || !titleEl) return;
  if (!currentStep) {
    bar.classList.add("hidden");
    if (detail) detail.classList.remove("open");
    return;
  }
  const num = currentStep.step_number ? `${currentStep.step_number}. ` : "";
  titleEl.textContent = `${num}${currentStep.title}`;
  titleEl.title = currentStep.title;
  if (detailBody) {
    detailBody.innerHTML = renderStepDetail(currentStep);
  }
  bar.classList.remove("hidden");
}

function renderStepDetail(step) {
  const parts = [];
  if (step.why) {
    parts.push(`<p class="step-detail-why">${escapeHtml(step.why)}</p>`);
  }
  if (step.click_steps?.length) {
    parts.push(`<ol>${step.click_steps.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ol>`);
  }
  if (step.notes?.length) {
    parts.push(step.notes.map(n => `<p class="step-detail-note">💡 ${escapeHtml(n)}</p>`).join(""));
  }
  if (step.links?.length) {
    const linkHtml = step.links.map(l => {
      const safe = l.url.replace(/"/g, "&quot;");
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a>`;
    }).join(" · ");
    parts.push(`<p class="step-detail-links">${linkHtml}</p>`);
  }
  return parts.length ? parts.join("") : `<p>${escapeHtml(step.description || step.title)}</p>`;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toggleStepDetail() {
  const detail = document.getElementById("step-detail");
  const btn = document.getElementById("step-expand-btn");
  if (!detail || !btn) return;
  const isOpen = detail.classList.toggle("open");
  btn.classList.toggle("open", isOpen);
}

async function markStepComplete(stepId) {
  if (!accountToken) throw new Error("No account token configured");
  const res = await fetch(`${webAppUrl}/api/steps/${stepId}?token=${accountToken}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "complete" })
  });
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
  currentStep = null;
  renderCurrentStep();
  await loadCurrentStep();
}

// ── Step completion ──────────────────────────────────────────────────────────
const MARK_COMPLETE_PATTERN = /\b(mark|set|check off|finish)\s+(this\s+)?(step\s+)?(as\s+)?(complete|completed|done|finished)\b/i;

async function handleMarkComplete() {
  if (!currentStep) {
    appendMessage("assistant", "No active step to mark complete.");
    return;
  }
  const completedTitle = currentStep.title;
  const stepId = currentStep.id;
  appendMessage("assistant", `Marking "${completedTitle}" complete…`);
  try {
    await markStepComplete(stepId);
    const next = currentStep ? `Now on Step ${currentStep.step_number}: ${currentStep.title}.` : "All steps complete.";
    appendMessage("assistant", `✓ Marked "${completedTitle}" complete. ${next}`);
  } catch (err) {
    appendMessage("error", `Could not mark step complete: ${err.message}`);
  }
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
    ? { id: currentStep.id, title: currentStep.title, description: currentStep.description }
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
  // No IDs — this can render multiple times per session, and we wire the
  // cancel listener directly to the button created here so subsequent
  // turns don't bind to a stale element from an earlier turn.
  container.innerHTML = `
    <span class="thinking-label">Thinking…</span>
    <span class="thinking-elapsed"></span>
    <button class="thinking-cancel hidden" title="Cancel">Cancel</button>
  `;
  document.getElementById("messages").appendChild(container);
  container.scrollIntoView({ behavior: "smooth", block: "end" });
  const elapsedEl = container.querySelector(".thinking-elapsed");
  const cancelBtn = container.querySelector(".thinking-cancel");
  cancelBtn.addEventListener("click", () => {
    cancelBtn.disabled = true;
    cancelBtn.textContent = "Cancelling…";
    if (onCancel) onCancel();
  });
  return {
    container,
    setElapsed: (s) => { elapsedEl.textContent = s >= 1 ? `${s}s` : ""; },
    showCancel: () => cancelBtn.classList.remove("hidden"),
  };
}

async function sendWithPrompt(prompt) {
  document.getElementById("user-input").value = prompt;
  await sendMessage();
}

function renderMarkdown(text) {
  // 1. Extract code blocks and URLs before HTML escaping so we can handle them cleanly
  const protected_ = [];
  let s = text;

  s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    protected_.push({ type: 'code', content: code });
    return `\x00P${protected_.length - 1}\x00`;
  });

  // Markdown links [text](url) — process before bare URL detection
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, label, url) => {
    const safeHref = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const safeLabel = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    protected_.push({ type: 'url', content: `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>` });
    return `\x00P${protected_.length - 1}\x00`;
  });

  // Full URLs with protocol
  s = s.replace(/https?:\/\/[^\s<>")\]]+/g, url => {
    const cleanUrl = url.replace(/[.,;:!?)\]]+$/, "");
    const trail = url.slice(cleanUrl.length);
    const safeHref = cleanUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    protected_.push({ type: 'url', content: `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${cleanUrl.replace(/&/g, '&amp;')}</a>${trail}` });
    return `\x00P${protected_.length - 1}\x00`;
  });

  // Bare domains like nodejs.org, claude.ai, console.anthropic.com
  // Match: word chars/hyphens, dots, common TLDs, optional /path
  s = s.replace(/\b([a-z0-9-]+(?:\.[a-z0-9-]+)+)(\/[^\s<>")\]]*)?/gi, (match, domain, path) => {
    if (!/\.(com|org|net|io|ai|app|dev|co|gov|edu|us|uk|ca|me|tv|info|tools|cloud|so|sh|page|tech|company|run)(\b|$)/i.test(domain)) return match;
    const url = (path ? domain + path : domain).replace(/[.,;:!?)\]]+$/, "");
    const trail = (path ? domain + path : domain).slice(url.length);
    const safeHref = "https://" + url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    protected_.push({ type: 'url', content: `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${url.replace(/&/g, '&amp;')}</a>${trail}` });
    return `\x00P${protected_.length - 1}\x00`;
  });

  // 2. HTML escape
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 3. Inline formatting
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // 4. Lists — process line by line; blank lines between consecutive list items are skipped
  const lines = s.split('\n');
  const out = [];
  let inUl = false, inOl = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ulM = line.match(/^- (.+)/);
    const olM = line.match(/^\d+\. (.+)/);

    if (ulM) {
      if (!inUl) { if (inOl) { out.push('</ol>'); inOl = false; } out.push('<ul>'); inUl = true; }
      out.push(`<li>${ulM[1]}</li>`);
    } else if (olM) {
      if (!inOl) { if (inUl) { out.push('</ul>'); inUl = false; } out.push('<ol>'); inOl = true; }
      out.push(`<li>${olM[1]}</li>`);
    } else if (line.trim() === '' && (inUl || inOl)) {
      // Blank line inside a list — peek ahead; if next non-empty line continues the same list, skip the blank
      const next = lines.slice(i + 1).find(l => l.trim() !== '');
      const continues = next && ((inUl && /^- /.test(next)) || (inOl && /^\d+\. /.test(next)));
      if (!continues) {
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (inOl) { out.push('</ol>'); inOl = false; }
        out.push(line);
      }
      // else: skip the blank line so the list stays together
    } else {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      out.push(line);
    }
  }
  if (inUl) out.push('</ul>');
  if (inOl) out.push('</ol>');

  // 5. Restore protected content
  let result = out.join('\n');
  result = result.replace(/\x00P(\d+)\x00/g, (_, i) => {
    const item = protected_[parseInt(i)];
    return item.type === 'code' ? `<pre><code>${item.content}</code></pre>` : item.content;
  });

  // 6. Paragraph and line breaks
  result = result.replace(/\n\n+/g, '</p><p>');
  result = result.replace(/\n/g, '<br>');
  return result;
}

function appendMessage(role, text) {
  const el = document.createElement("div");
  el.className = `message ${role}`;
  if (role === "assistant") {
    el.innerHTML = renderMarkdown(text);
  } else {
    el.textContent = text;
  }
  document.getElementById("messages").appendChild(el);
  el.scrollIntoView({ behavior: "smooth", block: "end" });
  return el;
}

function clearChat() {
  messages = [];
  document.getElementById("messages").innerHTML = "";
}

function updateMcpDot(connected) {
  const dot = document.getElementById("mcp-dot");
  if (!dot) return;
  dot.className = "mcp-dot " + (connected ? "connected" : "disconnected");
  dot.title = companionStatus.label || (connected ? "Connected" : "Companion not running");
}

// ── Actions ───────────────────────────────────────────────────────────────────
async function initActions() {
  const stored = await chrome.storage.local.get("all_actions");
  if (!stored.all_actions) {
    await chrome.storage.local.set({ all_actions: DEFAULT_ACTIONS });
  }
  renderActions(await getActions());
}

async function getActions() {
  const stored = await chrome.storage.local.get("all_actions");
  return stored.all_actions || DEFAULT_ACTIONS;
}

async function saveActions(actions) {
  await chrome.storage.local.set({ all_actions: actions });
}

function renderActions(actions) {
  const container = document.getElementById("action-btns");
  container.innerHTML = "";
  actions.forEach((action) => {
    const btn = document.createElement("button");
    btn.className = "quick-btn";
    btn.textContent = action.icon || "🔹";
    btn.title = action.label;
    btn.addEventListener("click", () => sendWithPrompt(action.prompt));
    container.appendChild(btn);
  });
  renderEditorList(actions);
}

function renderEditorList(actions) {
  const list = document.getElementById("actions-list");
  if (!list) return;
  list.innerHTML = "";
  if (actions.length === 0) { list.innerHTML = "<div class='no-actions'>No actions yet.</div>"; return; }
  actions.forEach((action, idx) => {
    const row = document.createElement("div");
    row.className = "action-row";
    row.innerHTML = `
      <div class="action-row-view">
        <span class="action-icon">${action.icon || "🔹"}</span>
        <span class="action-label">${action.label}</span>
        <span class="action-prompt-preview">${action.prompt}</span>
        <div class="action-row-btns">
          <button class="row-btn edit-btn" title="Edit">✎</button>
          <button class="row-btn remove-btn" title="Delete">✕</button>
        </div>
      </div>
      <div class="action-row-edit hidden">
        <div class="edit-icon-label-row">
          <input class="edit-icon-input" type="text" value="${action.icon || "🔹"}" maxlength="8" readonly>
          <input class="edit-label-input" type="text" value="${action.label}" maxlength="24">
        </div>
        <textarea class="edit-prompt-input" rows="3">${action.prompt}</textarea>
        <div class="edit-row-actions">
          <button class="row-btn save-edit-btn">Save</button>
          <button class="row-btn cancel-edit-btn">Cancel</button>
        </div>
      </div>`;
    row.querySelector(".edit-btn").addEventListener("click", () => toggleRowEdit(row, true));
    row.querySelector(".cancel-edit-btn").addEventListener("click", () => toggleRowEdit(row, false));
    row.querySelector(".remove-btn").addEventListener("click", () => deleteAction(idx));
    row.querySelector(".save-edit-btn").addEventListener("click", () => saveEditAction(row, idx));
    list.appendChild(row);
  });
}

function toggleRowEdit(row, editing) {
  row.querySelector(".action-row-view").classList.toggle("hidden", editing);
  row.querySelector(".action-row-edit").classList.toggle("hidden", !editing);
}

async function saveEditAction(row, idx) {
  const label = row.querySelector(".edit-label-input").value.trim();
  const icon  = row.querySelector(".edit-icon-input").value.trim() || "🔹";
  const prompt = row.querySelector(".edit-prompt-input").value.trim();
  if (!label || !prompt) return;
  const actions = await getActions();
  actions[idx] = { ...actions[idx], label, icon, prompt };
  await saveActions(actions);
  renderActions(actions);
}

async function deleteAction(idx) {
  const actions = await getActions();
  actions.splice(idx, 1);
  await saveActions(actions);
  renderActions(actions);
}

async function saveNewAction() {
  const label  = document.getElementById("new-action-label").value.trim();
  const icon   = document.getElementById("new-action-icon").value.trim() || "🔹";
  const prompt = document.getElementById("new-action-prompt").value.trim();
  if (!label || !prompt) return;
  const actions = await getActions();
  actions.push({ label, icon, prompt });
  await saveActions(actions);
  document.getElementById("new-action-label").value = "";
  document.getElementById("new-action-icon").value = "";
  document.getElementById("new-action-prompt").value = "";
  renderActions(actions);
}

function toggleEditor() {
  document.getElementById("actions-editor").classList.toggle("hidden");
}
