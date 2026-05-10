import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireClientUser } from "@/lib/auth";
import { runTurn, type ChatTurn } from "@/lib/agent/runtime";

export async function POST(request: Request) {
  const { user, clientId } = await requireClientUser();
  const { conversation_id, message } = await request.json();
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const supabase = await createClient();
  const admin    = createServiceClient();

  // Resolve client name + Anthropic API key. The portal user can read their
  // own client row, but secrets live in vault and require the service role.
  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .single();
  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });

  // Dedicated support inference key (ai-office-support) so chat traffic is
  // billed separately on Anthropic's side. Falls back to the shared key
  // for local dev / preview environments where SUPPORT isn't set.
  const apiKey = process.env.ANTHROPIC_API_KEY_SUPPORT ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "no Anthropic key configured" }, { status: 500 });

  // Find or create the conversation.
  let conversationId: string;
  if (conversation_id) {
    const { data: existing } = await supabase
      .from("support_tickets")
      .select("id")
      .eq("id", conversation_id)
      .eq("client_id", clientId)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "conversation not found" }, { status: 404 });
    conversationId = existing.id;
  } else {
    const title = message.slice(0, 80) + (message.length > 80 ? "…" : "");
    const { data: created, error: createErr } = await supabase
      .from("support_tickets")
      .insert({
        client_id: clientId,
        opened_by: user.id,
        title,
        kind: "chat",
        status: "open",
        priority: "normal",
      })
      .select("id")
      .single();
    if (createErr || !created) return NextResponse.json({ error: createErr?.message ?? "failed to create conversation" }, { status: 500 });
    conversationId = created.id;
  }

  // Load prior message history (most recent 50 turns). For now we only feed
  // the model the user/assistant text — tool_use/tool_result blocks aren't
  // replayed across turns. The DB still has the full record for admin views.
  const { data: priorRows } = await supabase
    .from("support_messages")
    .select("author_type, content")
    .eq("ticket_id", conversationId)
    .in("author_type", ["client", "ai"])
    .order("created_at", { ascending: true })
    .limit(50);

  const history: ChatTurn[] = (priorRows ?? [])
    .filter((r) => r.content && r.content.length > 0)
    .map((r) => ({
      role: r.author_type === "client" ? "user" as const : "assistant" as const,
      content: r.content,
    }));

  let result;
  try {
    result = await runTurn(
      { supabase: admin, clientId, clientName: client.name, apiKey },
      history,
      message,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `agent error: ${msg}` }, { status: 500 });
  }

  // Persist all the turn's records. Use service role to bypass RLS for
  // 'tool' / 'ai' author types that the portal_insert policy would block.
  const rows = result.records.map((r) => ({
    ticket_id:     conversationId,
    author_id:     r.role === "user" ? user.id : null,
    author_type:   r.role === "user" ? "client" : r.role === "assistant" ? "ai" : "tool",
    content:       r.content,
    tool_calls:    r.tool_calls ?? null,
    tool_results:  r.tool_results ?? null,
    input_tokens:  r.input_tokens ?? null,
    output_tokens: r.output_tokens ?? null,
    cost_cents:    r.cost_cents ?? null,
    model:         r.model ?? null,
  }));
  const { error: insertErr } = await admin.from("support_messages").insert(rows);
  if (insertErr) {
    return NextResponse.json({ error: `persist failed: ${insertErr.message}` }, { status: 500 });
  }

  // Bump the ticket's status so the list view shows recent activity.
  await admin
    .from("support_tickets")
    .update({ status: "ai_answered", updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return NextResponse.json({
    conversation_id: conversationId,
    response: result.finalText,
  });
}
