// GET   /api/support/tickets/[id] — ticket detail with messages.
// PATCH /api/support/tickets/[id] — update status (admin only).

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { createServiceClient }       from "@/lib/supabase/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS handles authorization: admin sees all, portal sees own client.
  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .select("id, title, status, priority, created_at, updated_at, client_id, clients(name)")
    .eq("id", id)
    .single();

  if (error || !ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: messages } = await supabase
    .from("support_messages")
    .select("id, author_type, author_id, content, metadata, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ ticket, messages: messages ?? [] });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only admins can change status via this endpoint.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { status?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed = ["open", "ai_answered", "waiting_on_dan", "resolved", "closed"];
  if (!body.status || !allowed.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 422 });
  }

  const svc = createServiceClient();
  const update: Record<string, unknown> = { status: body.status };
  if (body.status === "resolved") update.resolved_at = new Date().toISOString();

  await svc.from("support_tickets").update(update).eq("id", id);
  return NextResponse.json({ ok: true });
}
