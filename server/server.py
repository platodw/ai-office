#!/usr/bin/env python3
"""
AI Office — Local Companion Server
Routes chat from the Chrome extension through `claude -p` with the user's full MCP stack.

Endpoints:
  GET  /status  ->  { connected: true, version: "..." }
  POST /chat    ->  { message, page_context, history, current_step } -> { response }

Run: python server/server.py
Default port: 7848
"""

import json
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = 7848
VERSION = "0.2.0"

SYSTEM_PROMPT = """You are the AI Office assistant — a helpful guide embedded in the user's browser.
Your job is to help them set up Claude Desktop and get real value from it.

You can see the page they're currently viewing and their active setup step.
Be practical, clear, and beginner-friendly. Assume the user is new to this.
When giving instructions, use numbered steps. Keep responses concise — this is a browser sidepanel."""


def find_claude() -> str:
    """Find the claude CLI binary, checking common Windows locations."""
    candidates = [
        "claude",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\claude\claude.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\AnthropicClaude\claude.exe"),
        os.path.expanduser(r"~\AppData\Local\Programs\claude\claude.exe"),
    ]
    for c in candidates:
        try:
            result = subprocess.run([c, "--version"], capture_output=True, timeout=5)
            if result.returncode == 0:
                return c
        except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
            continue
    return "claude"


CLAUDE_BIN = find_claude()


def build_prompt(message: str, history: list, page_context: dict, current_step: dict | None) -> str:
    parts = [SYSTEM_PROMPT]

    if current_step:
        parts.append(
            f"\n\n[Current setup step]\n"
            f"Title: {current_step.get('title', '')}\n"
            f"Description: {current_step.get('description', '')}\n"
            "If the user's question relates to this step, prioritize relevant guidance."
        )

    if page_context and page_context.get("url"):
        content = page_context.get("text", "")[:6000]
        parts.append(
            f"\n\n[Browser page]\n"
            f"Title: {page_context.get('title', 'Unknown')}\n"
            f"URL: {page_context.get('url', '')}\n"
            f"Content:\n{content}"
        )

    if history:
        parts.append("\n\n[Conversation so far]")
        for turn in history[-8:]:
            role = "User" if turn.get("role") == "user" else "Assistant"
            parts.append(f"\n{role}: {turn.get('content', '')}")

    parts.append(f"\n\nUser: {message}\nAssistant:")
    return "".join(parts)


def run_claude(prompt: str) -> str:
    try:
        result = subprocess.run(
            [CLAUDE_BIN, "-p", "--permission-mode", "bypassPermissions", prompt],
            capture_output=True,
            text=True,
            timeout=120,
        )
        output = result.stdout.strip()
        if not output and result.stderr.strip():
            # Try without --permission-mode for older CLI versions
            result2 = subprocess.run(
                [CLAUDE_BIN, "-p", prompt],
                capture_output=True,
                text=True,
                timeout=120,
            )
            output = result2.stdout.strip() or result2.stderr.strip()
        return output or "(no response)"
    except subprocess.TimeoutExpired:
        return "Request timed out. Try a shorter question."
    except FileNotFoundError:
        return (
            f"Claude CLI not found at '{CLAUDE_BIN}'. "
            "Make sure Claude Code is installed: https://claude.ai/download"
        )
    except Exception as e:
        return f"Server error: {e}"


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[AI Office] {format % args}")

    def send_json(self, code: int, data: dict):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/status":
            self.send_json(200, {"connected": True, "version": VERSION})
        else:
            self.send_json(404, {"error": "Not found"})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}")
        except (json.JSONDecodeError, ValueError):
            self.send_json(400, {"error": "Invalid JSON"})
            return

        if self.path == "/chat":
            message = body.get("message", "").strip()
            if not message:
                self.send_json(400, {"error": "message is required"})
                return

            prompt = build_prompt(
                message=message,
                history=body.get("history") or [],
                page_context=body.get("page_context") or {},
                current_step=body.get("current_step"),
            )
            response = run_claude(prompt)
            self.send_json(200, {"response": response})
        else:
            self.send_json(404, {"error": "Not found"})


if __name__ == "__main__":
    print(f"AI Office server v{VERSION}")
    print(f"Claude CLI: {CLAUDE_BIN}")
    print(f"Listening on http://127.0.0.1:{PORT}")
    print("Press Ctrl+C to stop.\n")
    httpd = HTTPServer(("127.0.0.1", PORT), Handler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
