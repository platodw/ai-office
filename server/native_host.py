#!/usr/bin/env python3
"""
AI Office — Native Messaging host.

Chrome spawns this process when the extension calls
chrome.runtime.connectNative("com.aioffice.companion"). We read length-prefixed
JSON messages from stdin and write length-prefixed JSON responses to stdout.

Wire protocol:
  - 4-byte unsigned little-endian length prefix
  - UTF-8 JSON payload of that length

Request types we accept:
  { "type": "status" }
  { "type": "chat", "message": "...", "page_context": {...}, ... }
  { "type": "cancel" }            (sent on a separate post during streaming)

Streaming response shape (multiple messages per chat request):
  { "type": "chat_chunk", "text": "..." }
  { "type": "chat_done", "mode": "..." }
  { "type": "chat_error", "error": "..." }
"""

import json
import struct
import subprocess
import sys
import threading
import traceback

# Make sure stdio is binary on Windows so the length prefix isn't mangled by
# CRLF translation.
if sys.platform == "win32":
    import msvcrt
    import os as _os
    try:
        msvcrt.setmode(sys.stdin.fileno(), _os.O_BINARY)
    except OSError:
        pass
    try:
        msvcrt.setmode(sys.stdout.fileno(), _os.O_BINARY)
    except OSError:
        pass

from core import (  # noqa: E402
    StreamCancelled,
    TIMEOUT_FRIENDLY,
    VERSION,
    build_prompt,
    detect_route,
    stream_response,
)

# Single-message writes need to be serialized when streaming threads + the
# main read loop both want stdout. A simple lock is enough.
_send_lock = threading.Lock()
_cancel_flag = threading.Event()


def read_message() -> dict | None:
    """Read one length-prefixed message from stdin. Returns None on EOF."""
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) < 4:
        return None
    length = struct.unpack("<I", raw_length)[0]
    raw = sys.stdin.buffer.read(length)
    if len(raw) < length:
        return None
    return json.loads(raw.decode("utf-8"))


def send_message(payload: dict) -> None:
    """Write one length-prefixed JSON message to stdout."""
    with _send_lock:
        encoded = json.dumps(payload).encode("utf-8")
        sys.stdout.buffer.write(struct.pack("<I", len(encoded)))
        sys.stdout.buffer.write(encoded)
        sys.stdout.buffer.flush()


def stream_chat(request: dict) -> None:
    route = detect_route()
    if not route["ready"]:
        send_message({
            "type": "chat_error",
            "error": f"{route['label']} Install Claude Code to enable chat.",
        })
        return

    message = (request.get("message") or "").strip()
    if not message:
        send_message({"type": "chat_error", "error": "message is required"})
        return

    prompt = build_prompt(
        message=message,
        history=request.get("history") or [],
        page_context=request.get("page_context") or {},
        current_step=request.get("current_step"),
        guide_steps=request.get("guide_steps") or [],
        user_profile=request.get("user_profile"),
        user_questionnaire=request.get("user_questionnaire"),
    )

    _cancel_flag.clear()

    def on_chunk(text: str) -> None:
        send_message({"type": "chat_chunk", "text": text})

    try:
        stream_response(
            route=route,
            prompt=prompt,
            on_chunk=on_chunk,
            is_cancelled=_cancel_flag.is_set,
        )
        send_message({"type": "chat_done", "mode": route["mode"]})
    except subprocess.TimeoutExpired:
        send_message({"type": "chat_error", "error": TIMEOUT_FRIENDLY})
    except StreamCancelled:
        send_message({"type": "chat_error", "error": "Cancelled"})
    except Exception as e:
        send_message({"type": "chat_error", "error": f"Server error: {e}"})


def dispatch(request: dict) -> None:
    """Handle one request. May produce zero, one, or many response messages."""
    msg_type = request.get("type", "")
    if msg_type == "status":
        route = detect_route()
        send_message({
            "type": "status",
            "version": VERSION,
            "mode": route["mode"],
            "label": route["label"],
            "ready": route["ready"],
        })
        return
    if msg_type == "chat":
        # Stream from a worker thread so the main loop can keep reading
        # subsequent messages (e.g. cancel) while generation is in flight.
        threading.Thread(target=stream_chat, args=(request,), daemon=True).start()
        return
    if msg_type == "cancel":
        _cancel_flag.set()
        return
    send_message({"type": "error", "error": f"Unknown message type: {msg_type!r}"})


def main() -> None:
    while True:
        try:
            request = read_message()
        except Exception as e:
            send_message({"type": "error", "error": f"Could not read message: {e}"})
            return
        if request is None:
            return
        try:
            dispatch(request)
        except Exception:
            send_message({"type": "error", "error": traceback.format_exc()})


if __name__ == "__main__":
    main()
