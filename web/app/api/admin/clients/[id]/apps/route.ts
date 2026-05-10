import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  await requireAdmin();
  const { id: clientId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_apps")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request, { params }: Params) {
  await requireAdmin();
  const { id: clientId } = await params;
  const body = await request.json();
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_apps")
    .insert({ client_id: clientId, ...body })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
