import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; serviceId: string }> }) {
  const { id: clientId, serviceId } = await params;
  const supabase = await createClient();
  if (!await requireAdmin(supabase)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Partial<{
    name: string; description: string | null; type: string;
    amount_cents: number; billing_start: string; billing_end: string | null; status: string;
  }>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.type && !["one_time", "recurring_monthly"].includes(body.type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 422 });
  }
  if (body.status && !["active", "completed", "cancelled"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 422 });
  }

  const { error } = await supabase
    .from("client_services")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", serviceId)
    .eq("client_id", clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; serviceId: string }> }) {
  const { id: clientId, serviceId } = await params;
  const supabase = await createClient();
  if (!await requireAdmin(supabase)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase
    .from("client_services")
    .delete()
    .eq("id", serviceId)
    .eq("client_id", clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
