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
  const { data, error } = await admin
    .from("support_tickets")
    .select(`
      id, title, status, priority, created_at, client_id,
      clients(id, name, website, status),
      messages:support_messages(author_type, content, created_at),
      apps:client_apps(id, name, repo_url, production_url, hosting, tech_stack)
    `)
    .eq("kind", "ticket")
    .in("status", ["open", "waiting_on_dan"])
    .order("created_at", { ascending: true })
    .limit(5);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = NonNullable<typeof data>[number];
  const tickets = (data ?? []) as unknown as Row[];

  const ticketIds = tickets.map((t) => t.id);
  if (!ticketIds.length) return NextResponse.json({ tickets: [] });

  const { data: existing } = await admin
    .from("ticket_investigations")
    .select("ticket_id")
    .in("ticket_id", ticketIds);
  const investigatedIds = new Set((existing ?? []).map((r) => r.ticket_id));

  const pending = tickets.filter((t) => !investigatedIds.has(t.id));
  return NextResponse.json({ tickets: pending });
}
