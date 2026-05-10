import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/admin/clients/[id] — update client fields
export async function PATCH(request: Request, { params }: Params) {
  await requireAdmin();
  const { id } = await params;
  const body = await request.json();

  const allowed = ["name", "status", "notes", "website", "industry", "brand_color", "logo_url", "github_org"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
