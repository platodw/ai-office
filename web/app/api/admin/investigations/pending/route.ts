import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// Polled by the local Claude investigator script.
// Auth: Bearer token matching INVESTIGATION_SECRET env var.
//
// Returns tickets that need an investigation: kind='ticket', status open
// or waiting_on_dan, with no existing investigation row.

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const secret = process.env.INVESTIGATION_SECRET;
  if (!secret) return NextResponse.json({ error: "INVESTIGATION_SECRET not set" }, { status: 500 });
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createServiceClient();

  // Find tickets needing investigation: kind='ticket', live status, and
  // no row in ticket_investigations yet.
  // Fetch tickets + their conversation messages (PostgREST can resolve this
  // because support_messages.ticket_id → support_tickets.id is a real FK).
  const { data, error } = await admin
    .from("support_tickets")
    .select(`
      id, title, status, priority, created_at, client_id,
      clients(id, name, website, status),
      messages:support_messages(author_type, content, created_at)
    `)
    .eq("kind", "ticket")
    .in("status", ["open", "waiting_on_dan"])
    .order("created_at", { ascending: true })
    .limit(5);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Ticket = {
    id: string; title: string; status: string; priority: string; created_at: string; client_id: string;
    clients: unknown;
    messages: unknown;
    apps?: unknown;
  };
  const tickets = (data ?? []) as unknown as Ticket[];

  const ticketIds = tickets.map((t) => t.id);
  if (!ticketIds.length) return NextResponse.json({ tickets: [] });

  // Skip tickets that already have an investigation row.
  const { data: existing } = await admin
    .from("ticket_investigations")
    .select("ticket_id")
    .in("ticket_id", ticketIds);
  const investigatedIds = new Set((existing ?? []).map((r) => r.ticket_id));
  const pending = tickets.filter((t) => !investigatedIds.has(t.id));
  if (!pending.length) return NextResponse.json({ tickets: [] });

  // Apps belong to a client, not directly to a ticket — fetch separately
  // by the client_ids we need and attach to each ticket.
  const clientIds = Array.from(new Set(pending.map((t) => t.client_id)));
  const { data: apps } = await admin
    .from("client_apps")
    .select("id, client_id, name, repo_url, production_url, hosting, tech_stack")
    .in("client_id", clientIds);
  const appsByClient = new Map<string, typeof apps>();
  for (const a of apps ?? []) {
    const list = appsByClient.get(a.client_id) ?? [];
    list.push(a);
    appsByClient.set(a.client_id, list);
  }
  for (const t of pending) {
    t.apps = appsByClient.get(t.client_id) ?? [];
  }

  return NextResponse.json({ tickets: pending });
}
