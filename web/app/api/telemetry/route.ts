import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Server-side scrub pass to catch anything the extension's regex missed.
// Conservative: targets the most common identifiers we don't want stored.
function scrubServerSide(text: string): string {
  return text
    // emails
    .replace(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, "[email]")
    // phone numbers (NANP-ish)
    .replace(/\b\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[phone]")
    // 32-char tokens / API keys / UUIDs
    .replace(/\b[a-zA-Z0-9_-]{32,}\b/g, "[token]")
    // file paths (Win + POSIX)
    .replace(/[A-Z]:\\[^\s"<>|]+/g, "[path]")
    .replace(/\/(?:home|Users)\/[^\s"<>|]+/g, "[path]");
}

export async function POST(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401, headers: CORS });
    }

    const body = await request.json();
    const {
      session_id,
      step_id,
      page_domain,
      scrubbed_prompt,
      marked_complete_within_5min = false,
    } = body || {};

    if (!session_id || !scrubbed_prompt) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: CORS });
    }

    const supabase = createServiceClient();

    const { data: tokenRow } = await supabase
      .from("extension_tokens")
      .select("user_id")
      .eq("token", token)
      .single();
    if (!tokenRow) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: CORS });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("allow_telemetry")
      .eq("id", tokenRow.user_id)
      .single();

    // Silently drop if telemetry isn't enabled for this user. We don't return
    // an error so the extension never stalls retrying on a privacy refusal.
    if (!profile?.allow_telemetry) {
      return NextResponse.json({ ok: true, recorded: false }, { headers: CORS });
    }

    // Truncate extreme inputs and apply the second scrub pass.
    const cleanPrompt = scrubServerSide(String(scrubbed_prompt).slice(0, 4000));
    const cleanDomain = String(page_domain || "").slice(0, 200);

    await supabase.from("chat_telemetry").insert({
      user_id: tokenRow.user_id,
      session_id: String(session_id).slice(0, 80),
      step_id: step_id ? String(step_id).slice(0, 80) : null,
      page_domain: cleanDomain,
      scrubbed_prompt: cleanPrompt,
      marked_complete_within_5min: !!marked_complete_within_5min,
    });

    return NextResponse.json({ ok: true, recorded: true }, { headers: CORS });
  } catch (err) {
    console.error("Telemetry error:", err);
    // Always 200 so the extension's fire-and-forget never retries.
    return NextResponse.json({ ok: true, recorded: false, error: "internal" }, { headers: CORS });
  }
}
