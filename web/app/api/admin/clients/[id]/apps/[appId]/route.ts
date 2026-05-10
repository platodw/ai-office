import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string; appId: string }> };

const ALLOWED = ["name", "status", "production_url", "staging_url", "repo_url", "hosting", "tech_stack", "launched_at", "notes"];

export async function PATCH(request: Request, { params }: Params) {
  await requireAdmin();
  const { appId } = await params;
  const body = await request.json();

  const update: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in body) update[key] = body[key];
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.from("client_apps").update(update).eq("id", appId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  await requireAdmin();
  const { appId } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("client_apps").delete().eq("id", appId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
