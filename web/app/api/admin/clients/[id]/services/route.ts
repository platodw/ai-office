import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const supabase = await createClient();
  if (!await requireAdmin(supabase)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("client_services")
    .select("*")
    .eq("client_id", clientId)
    .order("billing_start", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const supabase = await createClient();
  if (!await requireAdmin(supabase)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    name: string; description?: string; type: string;
    amount_cents: number; billing_start: string; billing_end?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, description, type, amount_cents, billing_start, billing_end } = body;
  if (!name || !type || amount_cents == null || !billing_start) {
    return NextResponse.json({ error: "name, type, amount_cents, and billing_start are required" }, { status: 422 });
  }
  if (!["one_time", "recurring_monthly"].includes(type)) {
    return NextResponse.json({ error: "type must be one_time or recurring_monthly" }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("client_services")
    .insert({ client_id: clientId, name, description: description || null, type, amount_cents, billing_start, billing_end: billing_end || null })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ serviceId: data.id }, { status: 201 });
}
