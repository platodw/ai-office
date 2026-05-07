"""
AI Office — shared chat logic.

Used by both the HTTP server (server.py) and the Native Messaging host
(native_host.py). Knows how to detect which Claude route is available,
build a prompt, and run it through the Claude CLI.
"""

import json
import os
import queue
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from typing import Callable, Optional

VERSION = "0.4.2"

# Cached path to an empty MCP config file. We pass this to `claude -p` along
# with --strict-mcp-config so the user's MCP servers don't get spun up — they
# can take 10-30s to initialize and we don't need any of them for chat
# generation. Lazily written on first use.
_empty_mcp_config_path: Optional[Path] = None


def _ensure_empty_mcp_config() -> Path:
    global _empty_mcp_config_path
    if _empty_mcp_config_path and _empty_mcp_config_path.exists():
        return _empty_mcp_config_path
    p = Path(tempfile.gettempdir()) / "aioffice-empty-mcp.json"
    if not p.exists():
        p.write_text(json.dumps({"mcpServers": {}}), encoding="utf-8")
    _empty_mcp_config_path = p
    return p

SYSTEM_PROMPT = """You are the AI Office assistant, a helpful guide embedded in the user's browser. Your job is to help them set up Claude Desktop and get real value from it.

You will be given the user's profile, a one-line summary of their setup progress, their active step (with full detail), the page they are viewing, and recent conversation history.

Key rules:
- Always know what step the user is on. If they ask where they are or what to do next, answer from the active step block, not from the page.
- When the user navigates to a new page, connect it to their active step if relevant. Don't just describe what's on the page.
- Be practical and beginner-friendly. Use numbered steps for instructions.
- Keep responses concise. This is a browser sidepanel, not a long-form document."""


def find_claude() -> str | None:
    """Return a working path to the Claude Code CLI, or None if not found."""
    candidates = [
        "claude",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\claude\claude.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\AnthropicClaude\claude.exe"),
        os.path.expanduser(r"~\AppData\Local\Programs\claude\claude.exe"),
        "/Applications/Claude.app/Contents/MacOS/claude",
        os.path.expanduser("~/.local/bin/claude"),
    ]
    for c in candidates:
        try:
            result = subprocess.run([c, "--version"], capture_output=True, timeout=5)
            if result.returncode == 0:
                return c
        except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
            continue
    return None


def detect_route() -> dict:
    """Decide how to reach Claude and return a status dict.

    Shape: { mode, label, ready, claude_path?, version }
      mode = "claude_desktop" | "anthropic_api" | "not_connected"
      label = plain-English description shown to the user
      ready = whether chat will actually work
    """
    claude_path = find_claude()
    if claude_path:
        return {
            "mode": "claude_desktop",
            "label": "Claude Desktop is connected. Using your Claude subscription.",
            "ready": True,
            "claude_path": claude_path,
            "version": VERSION,
        }

    if os.environ.get("ANTHROPIC_API_KEY"):
        return {
            "mode": "anthropic_api",
            "label": "Using your Anthropic API key.",
            "ready": False,
            "version": VERSION,
        }

    return {
        "mode": "not_connected",
        "label": "Install Claude Desktop to get started.",
        "ready": False,
        "version": VERSION,
    }


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

    # One-line progress summary instead of listing every step. The active
    # step is reinjected at the bottom of the prompt with full detail; here
    # we only need enough orientation for "where am I" / "what's next" type
    # questions. Was ~1500 tokens for a 20-step guide, now ~50.
    if guide_steps:
        completed = sum(1 for s in guide_steps if s.get("status") in ("complete", "skipped"))
        total = len(guide_steps)
        current_id = (current_step or {}).get("id")
        next_step = None
        if current_id:
            seen_current = False
            for s in guide_steps:
                if seen_current and s.get("status") == "pending":
                    next_step = s
                    break
                if s.get("id") == current_id:
                    seen_current = True
        bits = [f"{completed} of {total} steps complete"]
        if current_step:
            bits.append(
                f"current: Step {current_step.get('step_number', '')} "
                f"({current_step.get('title', '')})"
            )
        if next_step:
            bits.append(
                f"next: Step {next_step.get('step_number', '')} "
                f"({next_step.get('title', '')})"
            )
        parts.append(f"\n\n[Setup progress] {'. '.join(bits)}.")

    if page_context and page_context.get("url"):
        # Cap at 2000 chars (was 6000). Setup-guide answers rarely need the
        # whole page — title + URL + a brief excerpt is enough orientation.
        content = page_context.get("text", "")[:2000]
        parts.append(
            f"\n\n[Browser page]\n"
            f"Title: {page_context.get('title', 'Unknown')}\n"
            f"URL: {page_context.get('url', '')}\n"
            f"Content:\n{content}"
        )

    if history:
        parts.append("\n\n[Conversation so far]")
        for turn in history[-6:]:
            role = "User" if turn.get("role") == "user" else "Assistant"
            parts.append(f"\n{role}: {turn.get('content', '')}")

    if current_step:
        parts.append(
            f"\n\n[REMINDER — active setup step]\n"
            f"The user is on Step {current_step.get('step_number', '')}: {current_step.get('title', '')}\n"
            f"{current_step.get('description', '')}\n"
            "Answer questions about what to do from this step. "
            "Do not suggest tasks from the page that are not part of this step."
        )

    parts.append(f"\n\nUser: {message}\nAssistant:")
    return "".join(parts)


DEFAULT_TIMEOUT_SEC = 300  # 5 minutes
TIMEOUT_FRIENDLY = (
    "Your question took longer than 5 minutes to answer. "
    "Try breaking it into smaller pieces or shortening it."
)


def run_claude(prompt: str, claude_bin: str, timeout: int = DEFAULT_TIMEOUT_SEC) -> str:
    """One-shot fallback used by the HTTP server. Blocks until done."""
    try:
        result = subprocess.run(
            [claude_bin, "-p", "--permission-mode", "bypassPermissions", prompt],
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=timeout,
        )
        output = result.stdout.strip()
        if not output and result.stderr.strip():
            result2 = subprocess.run(
                [claude_bin, "-p", prompt],
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            output = result2.stdout.strip() or result2.stderr.strip()
        return output or "(no response)"
    except subprocess.TimeoutExpired:
        return TIMEOUT_FRIENDLY
    except FileNotFoundError:
        return (
            f"Claude CLI not found at '{claude_bin}'. "
            "Make sure Claude Code is installed: https://claude.ai/download"
        )
    except Exception as e:
        return f"Server error: {e}"


class StreamCancelled(Exception):
    """Raised when the caller signals cancellation."""


def stream_claude(
    prompt: str,
    claude_bin: str,
    on_chunk: Callable[[str], None],
    timeout: int = DEFAULT_TIMEOUT_SEC,
    is_cancelled: Optional[Callable[[], bool]] = None,
) -> str:
    """Run `claude -p` and stream text deltas to on_chunk as they arrive.

    Uses --output-format=stream-json so we get token-by-token deltas instead
    of one big buffered response at the end. Skips the user's MCP servers via
    --strict-mcp-config + an empty --mcp-config so we don't pay 10-30s of
    init cost on every turn.

    Reader thread reads stdout line by line; each line is a JSON event. We
    pull the text out of `content_block_delta` events and forward them.
    """
    mcp_config = _ensure_empty_mcp_config()
    args = [
        claude_bin,
        # MCP arg is multi-value, so put it BEFORE -p so the prompt isn't
        # consumed as another config path.
        "--mcp-config", str(mcp_config),
        "--strict-mcp-config",
        "-p",
        "--output-format=stream-json",
        "--include-partial-messages",
        "--verbose",
        "--permission-mode", "bypassPermissions",
        prompt,
    ]
    proc = subprocess.Popen(
        args,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        bufsize=1,
    )

    q: "queue.Queue[tuple[str, Optional[str]]]" = queue.Queue()

    def reader(stream, kind):
        try:
            for line in stream:
                q.put((kind, line))
        except Exception as e:
            q.put(("err", str(e)))
        finally:
            q.put((f"{kind}_eof", None))

    threading.Thread(target=reader, args=(proc.stdout, "out"), daemon=True).start()
    threading.Thread(target=reader, args=(proc.stderr, "err_out"), daemon=True).start()

    deadline = time.monotonic() + timeout
    pieces: list[str] = []
    out_done = False
    err_done = False

    def handle_event(line: str) -> bool:
        """Extract text from a stream-json line. Returns True if we should stop."""
        line = line.strip()
        if not line:
            return False
        try:
            evt = json.loads(line)
        except json.JSONDecodeError:
            return False
        evt_type = evt.get("type")
        if evt_type == "stream_event":
            event = evt.get("event") or {}
            inner = event.get("type")
            if inner == "content_block_delta":
                delta = event.get("delta") or {}
                text = delta.get("text") or ""
                if text:
                    pieces.append(text)
                    on_chunk(text)
            elif inner == "message_stop":
                return True
        elif evt_type == "result":
            # Final result event — claude -p signals completion.
            return True
        return False

    try:
        while not (out_done and err_done):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                proc.kill()
                raise subprocess.TimeoutExpired(claude_bin, timeout)
            if is_cancelled and is_cancelled():
                proc.kill()
                raise StreamCancelled()
            try:
                kind, val = q.get(timeout=min(remaining, 0.5))
            except queue.Empty:
                continue
            if kind == "out" and val:
                if handle_event(val):
                    # We've seen the stop event; drain quickly and exit.
                    out_done = True
            elif kind == "out_eof":
                out_done = True
            elif kind == "err_out":
                pass  # captured but not surfaced
            elif kind == "err_out_eof":
                err_done = True
            elif kind == "err":
                raise RuntimeError(val or "stream read error")
    finally:
        if proc.poll() is None:
            proc.kill()

    proc.wait(timeout=5)
    return "".join(pieces).strip()


def handle_chat(payload: dict) -> dict:
    """Single dispatch point for a chat request. Returns a response dict."""
    message = (payload.get("message") or "").strip()
    if not message:
        return {"error": "message is required"}

    route = detect_route()
    if not route["ready"]:
        return {
            "response": (
                f"{route['label']}. Install Claude Code to enable chat: "
                "https://claude.ai/download"
            ),
            "mode": route["mode"],
        }

    prompt = build_prompt(
        message=message,
        history=payload.get("history") or [],
        page_context=payload.get("page_context") or {},
        current_step=payload.get("current_step"),
        guide_steps=payload.get("guide_steps") or [],
        user_profile=payload.get("user_profile"),
        user_questionnaire=payload.get("user_questionnaire"),
    )
    response = run_claude(prompt, route["claude_path"])
    return {"response": response, "mode": route["mode"]}
