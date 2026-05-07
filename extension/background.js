// AI Office — Background Service Worker

let isConnected = false;
let serverUrl = "http://127.0.0.1:7848";

// Load stored server URL
chrome.storage.local.get("server_url", (stored) => {
  if (stored.server_url) serverUrl = stored.server_url;
  checkConnection();
});

// Poll connection every 15 seconds
chrome.alarms.create("connection_poll", { periodInMinutes: 0.25 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "connection_poll") checkConnection();
});

async function checkConnection() {
  try {
    const res = await fetch(`${serverUrl}/status`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    setConnected(data.connected !== false);
  } catch {
    setConnected(false);
  }
}

function setConnected(connected) {
  if (isConnected === connected) return;
  isConnected = connected;
  updateIcon(connected);
  chrome.runtime.sendMessage({ type: "status_update", connected }).catch(() => {});
}

function updateIcon(connected) {
  chrome.action.setTitle({
    title: connected ? "AI Office: Connected" : "AI Office: Disconnected"
  });
}

// Open side panel on toolbar click
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "get_status") {
    sendResponse({ connected: isConnected, serverUrl });
  }
  if (message.type === "set_server_url") {
    serverUrl = message.url;
    chrome.storage.local.set({ server_url: serverUrl });
    checkConnection();
    sendResponse({ ok: true });
  }
  return true;
});
