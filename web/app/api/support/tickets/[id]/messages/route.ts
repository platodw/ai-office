// POST /api/support/tickets/[id]/messages — add a message to a ticket.
// Handles both client replies and admin replies; updates ticket status accordingly.

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { createServiceClient }       from "@/lib/supabase/service";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id: ticketId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { content?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 422 });
  }

  // Determine if user is admin.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  const isAdmin = !!profile?.is_admin;

  // Verify the ticket is accessible (RLS enforces client scoping automatically).
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, status, client_id")
    .eq("id", ticketId)
    .single();

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const authorType = isAdmin ? "admin" : "client";
  const svc = createServiceClient();

  // Insert message.
  const { data: message, error } = await svc
    .from("support_messages")
    .insert({
      ticket_id:   ticketId,
      author_id:   user.id,
      author_type: authorType,
      content:     body.content.trim(),
    })
    .select("id, author_type, author_id, content, created_at")
    .single();

  if (error || !message) {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }

  // Update ticket status based on who replied.
  const closedStatuses = ["resolved", "closed"];
  if (!closedStatuses.includes(ticket.status)) {
    let newStatus: string | null = null;

    if (isAdmin) {
      // Admin replied — ball is back in the client's court.
      newStatus = "open";
    } else {
      // Client replied on an AI-answered or resolved ticket — re-open.
      if (["ai_answered", "resolved"].includes(ticket.status)) {
        newStatus = "waiting_on_dan";
      }
    }

    if (newStatus) {
      await svc.from("support_tickets").update({ status: newStatus }).eq("id", ticketId);
    }
  }

  return NextResponse.json({ message }, { status: 201 });
}
