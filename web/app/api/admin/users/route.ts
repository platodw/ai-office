import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

// GET /api/admin/users — list all admin users
export async function GET() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, created_at")
    .eq("is_admin", true)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/admin/users — create a new admin user
export async function POST(request: Request) {
  await requireAdmin();
  const { email, password, name } = await request.json();
  if (!email || !password) return NextResponse.json({ error: "email and password required" }, { status: 400 });

  const admin = createServiceClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 });

  // Mark as admin and set name (trigger already created the profiles row)
  await admin.from("profiles").update({ is_admin: true, name: name ?? null }).eq("id", created.user.id);

  return NextResponse.json({ id: created.user.id, email });
}
