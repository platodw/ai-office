# AI Office

A Chrome extension and companion app that helps you set up Claude Desktop and then works alongside you in the browser, using your existing Claude subscription.

## What it does

- **Guided setup** for Claude Desktop — connects Gmail, Calendar, MCP servers, memory, and daily digest
- **Live chat** in a side panel that reads the current page and routes questions through Claude on your machine (with all your MCP tools)
- **Context-aware help** — knows what page you're on and gives relevant step-by-step instructions

## Install

You need three things: the Chrome extension, the companion app, and an account on [ai-office-gamma.vercel.app](https://ai-office-gamma.vercel.app).

### Install the Chrome extension

The Web Store listing is on the way. For now, install in developer mode:

1. Clone or download this repo (Code → Download ZIP if you don't use git, then unzip).
2. Open `chrome://extensions` in Chrome.
3. Toggle **Developer mode** on (top right).
4. Click **Load unpacked** and select the `extension/` folder from the repo.
5. The AI Office icon will appear in your Chrome toolbar. Pin it for easy access.
6. On the same `chrome://extensions` page, copy the extension's ID (the long string under "AI Office") — you'll need it in the next step.

### Run the companion installer

The companion is a tiny background app that lets the extension talk to Claude on your computer.

1. Download [`aioffice-setup.exe`](https://github.com/platodw/ai-office/releases/latest/download/aioffice-setup.exe) (Windows only for now).
2. Run it. When asked, paste the extension ID you copied.
3. The installer registers itself with Chrome — no firewall prompts, no port config.

### Connect your account

1. Sign up at [ai-office-gamma.vercel.app](https://ai-office-gamma.vercel.app).
2. From the dashboard, copy your token.
3. Open the AI Office side panel in Chrome and paste the token.

The status banner should turn green: *"Claude Desktop is connected. Using your Claude subscription."*

## Requirements

- Chrome or another Chromium-based browser
- [Claude Code](https://claude.ai/download) installed and signed in (the companion shells out to `claude -p`)
- Windows for the installer; macOS/Linux support coming

## Develop

Run the companion locally without bundling:

```
python server/server.py        # HTTP fallback on port 7848
# or
python server/install_manifest.py --extension-id <YOUR_ID>
```

The HTTP fallback lets the extension reach the companion at `http://127.0.0.1:7848` without registering a Native Messaging host.

Build the installer from source:

```
python installer/build.py     # produces installer/Output/aioffice-setup.exe
```

The build script needs PyInstaller (auto-installed) and, optionally, Inno Setup 6 to compile the final installer.

## Repo layout

- `extension/` — Chrome MV3 extension (manifest, side panel, content script, knowledge base)
- `server/` — companion: `core.py` (shared logic), `native_host.py` (primary transport), `server.py` (HTTP fallback)
- `installer/` — Inno Setup script and PyInstaller build script
- `web/` — Next.js web app (account, dashboard, setup guide generation)
- `supabase/` — database migrations
