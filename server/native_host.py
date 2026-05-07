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
"""

import json
import struct
import sys
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

from core import handle_chat, detect_route, VERSION  # noqa: E402


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
    encoded = json.dumps(payload).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def dispatch(request: dict) -> dict:
    msg_type = request.get("type", "")
    if msg_type == "status":
        route = detect_route()
        return {
            "type": "status",
            "version": VERSION,
            "mode": route["mode"],
            "label": route["label"],
            "ready": route["ready"],
        }
    if msg_type == "chat":
        result = handle_chat(request)
        return {"type": "chat", **result}
    return {"type": "error", "error": f"Unknown message type: {msg_type!r}"}


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
            response = dispatch(request)
        except Exception:
            response = {"type": "error", "error": traceback.format_exc()}
        try:
            send_message(response)
        except Exception:
            return


if __name__ == "__main__":
    main()
