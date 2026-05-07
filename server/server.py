#!/usr/bin/env python3
"""
AI Office — HTTP companion server (legacy / fallback).

The primary transport is now Native Messaging (see native_host.py). This HTTP
server is kept around for development and as a fallback for environments where
Native Messaging isn't registered.

Endpoints:
  GET  /status  ->  { connected, version, mode, label, ready }
  POST /chat    ->  { message, page_context, history, current_step, ... }
                ->  { response, mode }

Run: python server/server.py
Default port: 7848
"""

import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from core import VERSION, detect_route, handle_chat  # noqa: E402

PORT = 7848


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
            route = detect_route()
            self.send_json(200, {
                "connected": True,
                "version": VERSION,
                "mode": route["mode"],
                "label": route["label"],
                "ready": route["ready"],
            })
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
            result = handle_chat(body)
            if "error" in result and "response" not in result:
                self.send_json(400, result)
            else:
                self.send_json(200, result)
        else:
            self.send_json(404, {"error": "Not found"})


if __name__ == "__main__":
    route = detect_route()
    print(f"AI Office server v{VERSION}")
    print(f"Route: {route['label']}")
    if route.get("claude_path"):
        print(f"Claude CLI: {route['claude_path']}")
    print(f"Listening on http://127.0.0.1:{PORT}")
    print("Press Ctrl+C to stop.\n")
    httpd = HTTPServer(("127.0.0.1", PORT), Handler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
