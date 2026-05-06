# AI Office

A Chrome extension that connects to Claude Desktop and helps users set up and get real value from their Claude AI instance — then continues to work as an ongoing AI assistant right in the browser.

## What it does

- **Setup guidance**: walks users through connecting Gmail, Calendar, MCP servers, memory, and daily digest using a built-in knowledge base
- **Live chat**: reads the current page and routes questions through your actual Claude instance (with all your MCP tools)
- **Context-aware**: knows what page you're on and gives relevant step-by-step help

## Components

- `extension/` — Chrome MV3 extension (load unpacked in chrome://extensions)
- `server/server.py` — local companion server that routes chat through `claude -p`
- `extension/kb/` — knowledge base for Claude Desktop setup guidance

## Quick start

1. Start the companion server: `python server/server.py`
2. Load the extension: chrome://extensions → Developer mode → Load unpacked → select `extension/`
3. Click the AI Office icon in the toolbar
4. Enter the server URL (default: `http://127.0.0.1:7848`) and click Connect

## Requirements

- Claude Code CLI installed (`claude` in PATH)
- Chrome or Chromium-based browser
- Python 3.9+
