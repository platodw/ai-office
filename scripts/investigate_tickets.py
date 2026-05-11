"""
Poll AI Office for new support tickets and run a local `claude -p` session
to investigate each one. POST the result back to the admin investigations
endpoint so it shows on /admin/support/[id].

Designed to be invoked by Windows Task Scheduler every 2-3 minutes.

Environment:
    AI_OFFICE_URL          base URL, e.g. https://aioffice.danplato.com
    INVESTIGATION_SECRET   matches the Vercel env var
    CLAUDE_BIN             path to claude executable (default: 'claude')

The Claude agent inherits whatever MCPs are configured for the user that
invokes this script. The user's Anthropic max-plan subscription pays for
the inference (vs the metered API key used elsewhere in AI Office).
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from urllib import request as urlreq
from urllib.error import HTTPError, URLError


BASE_URL = os.environ.get("AI_OFFICE_URL", "https://aioffice.danplato.com").rstrip("/")
SECRET   = os.environ["INVESTIGATION_SECRET"]
CLAUDE   = os.environ.get("CLAUDE_BIN", "claude")
MODEL    = os.environ.get("CLAUDE_MODEL", "claude-opus-4-7")


def http(method: str, path: str, body: dict | None = None, timeout: int = 30) -> dict:
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urlreq.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {SECRET}",
        "Content-Type":  "application/json",
    })
    try:
        with urlreq.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except HTTPError as e:
        raise SystemExit(f"{method} {path} → {e.code}: {e.read().decode('utf-8', 'replace')[:400]}")
    except URLError as e:
        raise SystemExit(f"{method} {path} → URL error: {e}")


PROMPT_TEMPLATE = """You are the AI Office Support Investigator. A client just submitted a support ticket; your job is to investigate using your tools and report back in structured JSON.

You have access to the user's MCP servers — including Supabase (to read the AI Office DB and any client DB), GitHub (to read deployed-app repositories and open PRs if needed), Vercel (to check deploys/logs), and any others configured. Use them.

# Ticket
Client: {client_name}
Title: {ticket_title}
Apps deployed for this client: {apps}

# Full conversation (chat that led to this ticket)
{transcript}

# Your job
1. Investigate. Read the app's repo, check recent deploys/logs, query the relevant database, etc. Be thorough but efficient.
2. Decide ONE of:
   - reply_to_user: you have a complete answer the user can act on. Provide it in `suggested_reply` as a conversational message (no markdown).
   - request_info: you need more details before you can help. Put the specific questions in `suggested_reply`.
   - fix_code: there is a concrete code bug. Describe the fix in `suggested_change` and, if confident, open a PR via the GitHub MCP and put its URL in `pr_url`.
   - config_change: a configuration or data change is needed. Describe in `suggested_change`.
   - no_action: nothing obvious is wrong. Explain in `summary`.
3. Always populate `summary` with a 2-4 sentence plain-language description of what you found, including any error messages, suspicious patterns, or relevant context.

# Output format
Output ONLY a JSON object with these keys (no markdown fences, no preamble):
{{
  "summary": "...",
  "suggested_action": "reply_to_user | request_info | fix_code | config_change | no_action",
  "suggested_reply": "..." or null,
  "suggested_change": "..." or null,
  "pr_url": "..." or null
}}

Output the JSON now."""


def build_prompt(ticket: dict) -> str:
    msgs = ticket.get("messages") or []
    transcript_lines = []
    for m in msgs:
        role = m.get("author_type", "?")
        content = (m.get("content") or "").strip()
        if not content:
            continue
        transcript_lines.append(f"[{role}] {content}")
    transcript = "\n".join(transcript_lines) if transcript_lines else "(no messages)"

    apps = ticket.get("apps") or []
    apps_str = ", ".join(
        f"{a.get('name')} ({a.get('production_url') or 'no url'}, repo: {a.get('repo_url') or 'none'})"
        for a in apps
    ) or "(none)"

    client = ticket.get("clients") or {}
    return PROMPT_TEMPLATE.format(
        client_name   = client.get("name", "Unknown"),
        ticket_title  = ticket.get("title", "Untitled"),
        apps          = apps_str,
        transcript    = transcript,
    )


def run_claude(prompt: str, timeout_s: int = 600) -> str:
    """Run `claude -p` with the prompt on stdin and return its stdout."""
    proc = subprocess.run(
        [CLAUDE, "-p", "--model", MODEL],
        input=prompt,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout_s,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"claude exited {proc.returncode}: {proc.stderr[-1000:]}")
    return proc.stdout.strip()


def parse_claude_json(out: str) -> dict:
    # Strip markdown fences if Claude added them despite instructions.
    s = out.strip()
    if s.startswith("```"):
        # remove first fence line
        s = s.split("\n", 1)[1] if "\n" in s else s[3:]
        # remove closing fence
        if s.endswith("```"):
            s = s[:-3]
        s = s.strip()
    # Find the JSON object — sometimes Claude pads with a closing sentence.
    first = s.find("{")
    last  = s.rfind("}")
    if first == -1 or last == -1:
        raise ValueError(f"no JSON object found in output: {s[:400]}")
    return json.loads(s[first : last + 1])


def investigate_one(ticket: dict) -> None:
    ticket_id = ticket["id"]
    print(f"[{ticket_id}] investigating: {ticket['title']!r}", flush=True)

    # Claim the slot so a concurrent poll doesn't double-investigate.
    http("POST", "/api/admin/investigations", {
        "ticket_id": ticket_id,
        "status":    "running",
        "model":     MODEL,
    })

    try:
        prompt = build_prompt(ticket)
        raw = run_claude(prompt)
        parsed = parse_claude_json(raw)
    except Exception as e:
        print(f"[{ticket_id}] failed: {e}", flush=True)
        http("POST", "/api/admin/investigations", {
            "ticket_id": ticket_id,
            "status":    "failed",
            "error":     str(e)[:1500],
            "model":     MODEL,
        })
        return

    http("POST", "/api/admin/investigations", {
        "ticket_id":        ticket_id,
        "status":           "done",
        "summary":          parsed.get("summary"),
        "suggested_action": parsed.get("suggested_action"),
        "suggested_reply":  parsed.get("suggested_reply"),
        "suggested_change": parsed.get("suggested_change"),
        "pr_url":           parsed.get("pr_url"),
        "model":            MODEL,
    })
    print(f"[{ticket_id}] done: {parsed.get('suggested_action')}", flush=True)


def main() -> int:
    resp = http("GET", "/api/admin/investigations/pending")
    tickets = resp.get("tickets") or []
    if not tickets:
        return 0
    print(f"found {len(tickets)} ticket(s) to investigate", flush=True)
    for t in tickets:
        try:
            investigate_one(t)
        except Exception as e:
            print(f"[{t.get('id')}] outer error: {e}", flush=True)
        time.sleep(1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
