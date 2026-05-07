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


def build_prompt(
    message: str,
    history: list,
    page_context: dict,
    current_step: dict | None,
    guide_steps: list,
    user_profile: dict | None,
    user_questionnaire: dict | None,
) -> str:
    parts = [SYSTEM_PROMPT]

    if user_profile or user_questionnaire:
        lines = ["\n\n[User profile]"]
        if user_profile:
            lines.append(f"  Name: {user_profile.get('name', 'Unknown')}")
            lines.append(f"  OS: {user_profile.get('os', 'Unknown')}")
        if user_questionnaire:
            q = user_questionnaire
            if q.get("use_case"):
                lines.append(f"  Setting up for: {q['use_case']}")
            if q.get("categories"):
                lines.append(f"  Focus areas: {', '.join(q['categories'])}")
            if q.get("google_gmail") or q.get("microsoft_outlook"):
                email = []
                if q.get("google_gmail"): email.append("Gmail")
                if q.get("microsoft_outlook"): email.append("Outlook")
                lines.append(f"  Email: {', '.join(email)}")
            if q.get("google_calendar") or q.get("microsoft_calendar"):
                cal = []
                if q.get("google_calendar"): cal.append("Google Calendar")
                if q.get("microsoft_calendar"): cal.append("Microsoft Calendar")
                lines.append(f"  Calendar: {', '.join(cal)}")
            if q.get("note_taking_tool"):
                lines.append(f"  Notes: {q['note_taking_tool']}")
            if q.get("messaging_app"):
                lines.append(f"  Messaging: {q['messaging_app']}")
            if q.get("finance_tools"):
                lines.append(f"  Finance tools: {', '.join(q['finance_tools'])}")
            if q.get("creative_tools"):
                lines.append(f"  Creative tools: {', '.join(q['creative_tools'])}")
            if q.get("github"): lines.append("  Uses: GitHub")
            if q.get("goal"):
                lines.append(f"  Goal: {q['goal']}")
        parts.append("\n".join(lines))

    if guide_steps:
        completed = sum(1 for s in guide_steps if s.get("status") in ("complete", "skipped"))
        total = len(guide_steps)
        lines = [f"\n\n[User's setup guide — {completed}/{total} steps complete]"]
        current_id = (current_step or {}).get("id")
        for s in guide_steps:
            if s.get("status") in ("complete", "skipped"):
                marker = "✓"
            elif s.get("id") == current_id:
                marker = "→"
            else:
                marker = "○"
            lines.append(f"  {marker} Step {s.get('step_number', '')}: {s.get('title', '')} [{s.get('section', '')}]")
        parts.append("\n".join(lines))

    if current_step:
        parts.append(
            f"\n\n[Currently working on]\n"
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
                guide_steps=body.get("guide_steps") or [],
                user_profile=body.get("user_profile"),
                user_questionnaire=body.get("user_questionnaire"),
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
