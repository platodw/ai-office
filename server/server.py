#!/usr/bin/env python3
"""
AI Office — Local Companion Server

Routes chat from the AI Office Chrome extension through `claude -p`
with the user's full MCP stack.

Endpoints:
  GET  /status  -> { connected: true, version: "0.1.0" }
  POST /chat    -> { message, page_context } -> { response }

Run: python server.py
Default port: 7848
"""

import json
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

PORT = 7848
VERSION = "0.1.0"

# Path to claude CLI — adjust if needed
CLAUDE_BIN = "claude"


def run_claude(prompt: str) -> str:
    """Run claude -p with the given prompt and return the response."""
    try:
        result = subprocess.run(
            [CLAUDE_BIN, "-p", "--permission-mode", "bypassPermissions", prompt],
            capture_output=True,
            text=True,
            timeout=120,
        )
        return result.stdout.strip() or result.stderr.strip() or "(no response)"
    except subprocess.TimeoutExpired:
        return "Request timed out."
    except FileNotFoundError:
        return "claude CLI not found. Make sure Claude Code is installed and in your PATH."


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[AI Office] {self.address_string()} {format % args}")

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
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length) or b"{}")

        if self.path == "/chat":
            message = body.get("message", "")
            page_context = body.get("page_context", {})

            # Build prompt with page context
            page_text = ""
            if page_context:
                page_text = (
                    f"\n\nCurrent page: {page_context.get('title', '')} "
                    f"({page_context.get('url', '')})\n"
                    f"Page content:\n{page_context.get('text', '')[:8000]}"
                )

            full_prompt = f"{message}{page_text}"
            response = run_claude(full_prompt)
            self.send_json(200, {"response": response})
        else:
            self.send_json(404, {"error": "Not found"})


if __name__ == "__main__":
    print(f"AI Office server v{VERSION} starting on port {PORT}...")
    print(f"Using claude CLI: {CLAUDE_BIN}")
    httpd = HTTPServer(("127.0.0.1", PORT), Handler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
