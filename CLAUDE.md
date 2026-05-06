# AI Office — Chrome Extension

## Vision

AI Office is a Chrome extension (MV3) that helps users set up and get real value from Claude Desktop. It combines:

1. **Setup guidance** — walks users through connecting Gmail, Calendar, MCP servers, memory, and daily digest using a built-in knowledge base
2. **Live chat** — once connected, works like an ongoing Claude assistant: reads the current page, runs prompts, routes through the user's local Claude instance (with all their MCP tools)
3. **Context-aware help** — knows what page the user is on and gives relevant guidance (e.g., on console.anthropic.com it guides API key setup; on Google Cloud it guides OAuth setup)

## Target users

DPC AI Office clients and friends who want a real Claude setup without the config headaches.

## Architecture

```
Chrome Extension (AI Office)
  └─ sidepanel.html/js/css   — UI (setup wizard + chat interface)
  └─ background.js           — service worker, status, side panel
  └─ content.js              — page DOM extraction
  └─ kb/                     — bundled knowledge base (markdown → JSON)

Local Companion Server (ai-office-server)
  └─ server.py               — HTTP server on configurable port (default 7848)
  └─ routes chat through claude -p with user's MCP stack
  └─ exposes /chat, /setup, /status endpoints
```

## Extension ↔ Server protocol

- `GET /status` → `{ connected: true, version: "..." }`
- `POST /chat` → `{ message, page_context }` → `{ response }`
- `POST /setup` → `{ step, page_context }` → `{ guidance, next_step }`

The companion server is a separate installable (Python script + Task Scheduler or launchd entry). For Dan's own setup, it reuses the existing task monitor at localhost:7847 via a /claude-chat endpoint.

## Setup flow (planned)

1. Install extension → enter local server URL (default: http://127.0.0.1:7848)
2. Extension pings /status to confirm connection
3. Setup wizard detects what's configured, what's missing
4. User walks through steps: API key → MCP servers → Gmail → Calendar → memory → digest
5. Each step is context-aware: extension reads the current page DOM and the KB to give live instructions
6. After setup, extension works as an ongoing Claude assistant (same as Wavebox extension)

## Knowledge base

`kb/` contains markdown files covering each setup domain. At build time (or on first load), these are bundled into `kb/index.json` for fast lookup. The extension can also send KB content to Claude as system context for richer guided answers.

## Key files to build next

- [ ] `server/server.py` — companion HTTP server
- [ ] `extension/kb/` — knowledge base markdown files (start with claude-desktop-setup.md)
- [ ] `extension/sidepanel.js` — setup wizard flow + chat mode
- [ ] `scripts/build-kb.py` — bundle KB markdown → kb/index.json

## Local dev

```
C:\Users\dan\projects\ai-office\
```

Load extension: chrome://extensions → Developer mode → Load unpacked → select `extension/`
