import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/clients/[id]/users — list portal users for a client
export async function GET(_request: Request, { params }: Params) {
  await requireAdmin();
  const { id: clientId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("client_users")
    .select("id, user_id, portal_role, created_at, profiles(name, email)")
    .eq("client_id", clientId)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/admin/clients/[id]/users — create a portal user for a client
export async function POST(request: Request, { params }: Params) {
  await requireAdmin();
  const { id: clientId } = await params;
  const { email, password, name, portal_role = "power_user" } = await request.json();
  if (!email || !password) return NextResponse.json({ error: "email and password required" }, { status: 400 });

  const admin = createServiceClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 });

  if (name) {
    await admin.from("profiles").update({ name }).eq("id", created.user.id);
  }

  const { error: linkErr } = await admin
    .from("client_users")
    .insert({ user_id: created.user.id, client_id: clientId, portal_role });
  if (linkErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: created.user.id, email });
}
