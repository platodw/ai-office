// AI Office — Side Panel
// Connects to a local Claude companion server and provides
// setup guidance + ongoing chat with the user's Claude instance.

const MAX_PAGE_CHARS = 40000;

const DEFAULT_ACTIONS = [
  { label: "Summarize",    icon: "📝", prompt: "Summarize this page in 3-5 sentences." },
  { label: "Key Facts",    icon: "🔑", prompt: "What are the key facts or data points on this page?" },
  { label: "Main Point",   icon: "🎯", prompt: "What is the main argument or point being made on this page?" },
  { label: "Action Items", icon: "✅", prompt: "List any action items or next steps mentioned on this page." }
];

let serverUrl = "http://127.0.0.1:7848";
let pageContext = null;
let messages = [];

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const stored = await chrome.storage.local.get(["server_url", "configured"]);
  if (stored.server_url) serverUrl = stored.server_url;

  if (stored.configured) {
    showChatScreen();
    await loadPageContext();
  } else {
    document.getElementById("server-url-input").value = serverUrl;
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
  document.getElementById("settings-btn").addEventListener("click", () => showSetupScreen());
  document.getElementById("add-action-btn").addEventListener("click", toggleEditor);
  document.getElementById("close-editor-btn").addEventListener("click", toggleEditor);
  document.getElementById("save-action-btn").addEventListener("click", saveNewAction);

  chrome.runtime.sendMessage({ type: "get_status" }, (res) => {
    if (res) { serverUrl = res.serverUrl || serverUrl; updateMcpDot(res.connected); }
  });
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "status_update") updateMcpDot(msg.connected);
  });

  chrome.tabs.onActivated.addListener(() => handleTabChange());
  chrome.tabs.onUpdated.addListener((id, info, tab) => {
    if (tab.active && info.status === "complete") handleTabChange();
  });

  await initActions();
});

let tabChangeTimer = null;
function handleTabChange() {
  clearTimeout(tabChangeTimer);
  tabChangeTimer = setTimeout(async () => {
    pageContext = null;
    messages = [];
    document.getElementById("messages").innerHTML = "";
    document.getElementById("page-title").textContent = "Loading...";
    setFavicon(null);
    await loadPageContext();
  }, 500);
}

// ── Connection ────────────────────────────────────────────────────────────────
async function connect() {
  const urlVal = document.getElementById("server-url-input").value.trim();
  if (urlVal) serverUrl = urlVal;
  try {
    const res = await fetch(`${serverUrl}/status`, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    if (data.connected !== false) {
      await chrome.storage.local.set({ server_url: serverUrl, configured: true });
      chrome.runtime.sendMessage({ type: "set_server_url", url: serverUrl });
      showChatScreen();
      await loadPageContext();
    } else {
      alert("Server responded but reported not connected. Check your Claude setup.");
    }
  } catch (err) {
    alert(`Could not reach ${serverUrl}\n\nMake sure the AI Office companion server is running.`);
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

// ── Chat ──────────────────────────────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById("user-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  if (!pageContext) await loadPageContext();

  appendMessage("user", text);
  messages.push({ role: "user", content: text });

  const sendBtn = document.getElementById("send-btn");
  sendBtn.disabled = true;
  const thinkingEl = appendMessage("thinking", "Thinking...");

  try {
    const res = await fetch(`${serverUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, page_context: pageContext, history: messages.slice(-10) })
    });
    thinkingEl.remove();
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    const reply = data.response || "(no response)";
    appendMessage("assistant", reply);
    messages.push({ role: "assistant", content: reply });
  } catch (err) {
    thinkingEl.remove();
    if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
      appendMessage("error", "Could not reach AI Office server. Is it running?");
    } else {
      appendMessage("error", `Error: ${err.message}`);
    }
  } finally {
    sendBtn.disabled = false;
  }
}

async function sendWithPrompt(prompt) {
  document.getElementById("user-input").value = prompt;
  await sendMessage();
}

function appendMessage(role, text) {
  const el = document.createElement("div");
  el.className = `message ${role}`;
  el.textContent = text;
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
