import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyDanNewApproval } from "@/lib/support/notify";

// Local Claude investigator POSTs findings here when a ticket investigation
// completes. Auth: Bearer token matching INVESTIGATION_SECRET.
//
// Body shape (one of):
//   { ticket_id, status: 'running', model? }                   // claim a ticket
//   { ticket_id, status: 'done', summary, suggested_action, suggested_reply?, suggested_change?, pr_url?, model? }
//   { ticket_id, status: 'failed', error, model? }

type InvestigationBody = {
  ticket_id:         string;
  status:            "running" | "done" | "failed";
  summary?:          string;
  suggested_action?: "reply_to_user" | "request_info" | "fix_code" | "config_change" | "no_action";
  suggested_reply?:  string;
  suggested_change?: string;
  pr_url?:           string;
  model?:            string;
  error?:            string;
};

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const secret = process.env.INVESTIGATION_SECRET;
  if (!secret) return NextResponse.json({ error: "INVESTIGATION_SECRET not set" }, { status: 500 });
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json()) as InvestigationBody;
  if (!body.ticket_id || !body.status) {
    return NextResponse.json({ error: "ticket_id and status required" }, { status: 400 });
  }

  const admin = createServiceClient();
  const { data: ticket, error: ticketErr } = await admin
    .from("support_tickets")
    .select("id, client_id, title, clients(name)")
    .eq("id", body.ticket_id)
    .single();
  if (ticketErr || !ticket) return NextResponse.json({ error: "ticket not found" }, { status: 404 });

  if (body.status === "running") {
    const { data: created, error } = await admin
      .from("ticket_investigations")
      .insert({
        ticket_id: body.ticket_id,
        client_id: ticket.client_id,
        status: "running",
        model: body.model ?? null,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: created.id, status: "running" });
  }

  // status is 'done' or 'failed' — find the running investigation for this ticket.
  const { data: investigation, error: lookupErr } = await admin
    .from("ticket_investigations")
    .select("id")
    .eq("ticket_id", body.ticket_id)
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  if (!investigation) {
    return NextResponse.json({ error: "no running investigation found for ticket — call with status=running first" }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    status: body.status,
    summary: body.summary ?? null,
    suggested_action: body.suggested_action ?? null,
    suggested_reply: body.suggested_reply ?? null,
    suggested_change: body.suggested_change ?? null,
    pr_url: body.pr_url ?? null,
    error: body.error ?? null,
    completed_at: new Date().toISOString(),
  };
  if (body.model) update.model = body.model;

  const { error: updateErr } = await admin
    .from("ticket_investigations")
    .update(update)
    .eq("id", investigation.id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Telegram ping when investigation completes successfully.
  if (body.status === "done") {
    const clientName = (ticket.clients as unknown as { name: string } | null)?.name ?? "Unknown";
    await notifyDanNewApproval({
      clientName,
      kind: "action",
      toolName: "investigation_complete",
      title: `Investigation: ${ticket.title}`,
      description: (body.summary ?? "").slice(0, 400),
    });
  }

  return NextResponse.json({ ok: true, id: investigation.id });
}
