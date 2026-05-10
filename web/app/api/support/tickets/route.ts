// POST /api/support/tickets — create a ticket and trigger AI response.
// GET  /api/support/tickets — admin: list all; portal: list own client's.

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { createServiceClient }       from "@/lib/supabase/service";
import { generateSupportResponse }   from "@/lib/support/ai-responder";
import { notifyDanNewTicket }        from "@/lib/support/notify";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve client membership.
  const { data: membership } = await supabase
    .from("client_users")
    .select("client_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { title?: string; body?: string; priority?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, body: messageBody, priority = "normal" } = body;
  if (!title?.trim() || !messageBody?.trim()) {
    return NextResponse.json({ error: "title and body are required" }, { status: 422 });
  }

  const svc = createServiceClient();

  // Insert the ticket.
  const { data: ticket, error: ticketErr } = await svc
    .from("support_tickets")
    .insert({
      client_id: membership.client_id,
      opened_by: user.id,
      title:     title.trim(),
      priority,
      status:    "open",
    })
    .select("id")
    .single();

  if (ticketErr || !ticket) {
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }

  // Insert the client's opening message.
  await svc.from("support_messages").insert({
    ticket_id:   ticket.id,
    author_id:   user.id,
    author_type: "client",
    content:     messageBody.trim(),
  });

  // Run the AI responder (non-blocking — failure doesn't affect ticket creation).
  runAIResponse(ticket.id, membership.client_id, title.trim(), messageBody.trim()).catch(
    (err) => console.error("[support] AI responder error:", err)
  );

  return NextResponse.json({ ticketId: ticket.id }, { status: 201 });
}

async function runAIResponse(
  ticketId:  string,
  clientId:  string,
  title:     string,
  body:      string,
) {
  const svc = createServiceClient();

  let aiResult;
  try {
    aiResult = await generateSupportResponse(title, body);
  } catch (err) {
    // If AI errors out, treat as low-confidence and escalate.
    console.error("[support] AI error:", err);
    aiResult = { answer: null, confident: false, articleIds: [], inputTokens: 0, outputTokens: 0 };
  }

  if (aiResult.confident && aiResult.answer) {
    // Post AI answer and mark ticket as answered.
    await svc.from("support_messages").insert({
      ticket_id:   ticketId,
      author_id:   null,
      author_type: "ai",
      content:     aiResult.answer,
      metadata: {
        article_ids:   aiResult.articleIds,
        input_tokens:  aiResult.inputTokens,
        output_tokens: aiResult.outputTokens,
      },
    });

    await svc
      .from("support_tickets")
      .update({ status: "ai_answered", kb_article_id: aiResult.articleIds[0] ?? null })
      .eq("id", ticketId);
  } else {
    // Escalate to Dan.
    await svc
      .from("support_tickets")
      .update({ status: "waiting_on_dan" })
      .eq("id", ticketId);

    await svc.from("support_messages").insert({
      ticket_id:   ticketId,
      author_id:   null,
      author_type: "system",
      content:     "We've forwarded this to our team. You'll hear back shortly.",
    });

    // Look up client name for the Telegram message.
    const { data: client } = await svc
      .from("clients")
      .select("name")
      .eq("id", clientId)
      .single();

    await notifyDanNewTicket({
      ticketId,
      clientName: client?.name ?? "Unknown client",
      title,
      body,
    });
  }
}
