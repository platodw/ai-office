import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const CHAT_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are the AI Office assistant, a helpful guide embedded in the user's browser. Your job is to help them set up Claude Desktop and get real value from it.

You will be given the user's profile, a one-line summary of their setup progress, their active step (with full detail), the page they are viewing, and recent conversation history.

Key rules:
- Always know what step the user is on. If they ask where they are or what to do next, answer from the active step block, not from the page.
- When the user navigates to a new page, connect it to their active step if relevant. Don't just describe what's on the page.
- Be practical and beginner-friendly. Use numbered steps for instructions.
- Keep responses concise. This is a browser sidepanel, not a long-form document.`;

function buildUserContent(body: {
  message: string;
  history?: { role: string; content: string }[];
  page_context?: { url?: string; title?: string; text?: string };
  current_step?: Record<string, unknown>;
  guide_steps?: { status?: string; step_number?: number; title?: string; id?: string }[];
  user_profile?: { name?: string; os?: string };
  user_questionnaire?: Record<string, unknown>;
}): string {
  const parts: string[] = [];

  if (body.user_profile || body.user_questionnaire) {
    const lines = ["[User profile]"];
    if (body.user_profile) {
      lines.push(`  Name: ${body.user_profile.name ?? "Unknown"}`);
      lines.push(`  OS: ${body.user_profile.os ?? "Unknown"}`);
    }
    if (body.user_questionnaire) {
      const q = body.user_questionnaire as Record<string, unknown>;
      if (q.use_case) lines.push(`  Setting up for: ${q.use_case}`);
      if (Array.isArray(q.categories) && q.categories.length) lines.push(`  Focus areas: ${q.categories.join(", ")}`);
      if (q.goal) lines.push(`  Goal: ${q.goal}`);
    }
    parts.push(lines.join("\n"));
  }

  if (body.guide_steps?.length) {
    const steps = body.guide_steps;
    const completed = steps.filter(s => s.status === "complete" || s.status === "skipped").length;
    const total = steps.length;
    const current = body.current_step as { id?: string; step_number?: number; title?: string } | undefined;
    const currentId = current?.id;
    let nextStep: typeof steps[0] | undefined;
    if (currentId) {
      let seenCurrent = false;
      for (const s of steps) {
        if (seenCurrent && s.status === "pending") { nextStep = s; break; }
        if (s.id === currentId) seenCurrent = true;
      }
    }
    const bits = [`${completed} of ${total} steps complete`];
    if (current) bits.push(`current: Step ${current.step_number ?? ""} (${current.title ?? ""})`);
    if (nextStep) bits.push(`next: Step ${nextStep.step_number ?? ""} (${nextStep.title ?? ""})`);
    parts.push(`[Setup progress] ${bits.join(". ")}.`);
  }

  if (body.page_context?.url) {
    const content = (body.page_context.text ?? "").slice(0, 2000);
    parts.push(
      `[Browser page]\nTitle: ${body.page_context.title ?? "Unknown"}\nURL: ${body.page_context.url}\nContent:\n${content}`
    );
  }

  if (body.history?.length) {
    const historyLines = ["[Conversation so far]"];
    for (const turn of body.history.slice(-6)) {
      const role = turn.role === "user" ? "User" : "Assistant";
      historyLines.push(`${role}: ${turn.content}`);
    }
    parts.push(historyLines.join("\n"));
  }

  if (body.current_step) {
    const step = body.current_step as Record<string, unknown>;
    parts.push(
      `[REMINDER — active setup step]\nThe user is on Step ${step.step_number ?? ""}: ${step.title ?? ""}\n${step.description ?? ""}\nAnswer questions about what to do from this step. Do not suggest tasks from the page that are not part of this step.`
    );
  }

  parts.push(`User: ${body.message}\nAssistant:`);
  return parts.join("\n\n");
}

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401, headers: CORS });
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

  let body: Parameters<typeof buildUserContent>[0];
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: CORS });
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400, headers: CORS });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Chat not configured" }, { status: 503, headers: CORS });
  }

  const client = new Anthropic({ apiKey });
  const userContent = buildUserContent(body);

  // Stream SSE back to the extension
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) =>
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));

      try {
        const anthropicStream = await client.messages.stream({
          model: CHAT_MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userContent }],
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send(JSON.stringify({ type: "chunk", text: event.delta.text }));
          }
        }
        send(JSON.stringify({ type: "done" }));
      } catch (err) {
        send(JSON.stringify({ type: "error", error: String(err) }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
