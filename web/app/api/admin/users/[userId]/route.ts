import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

type Params = { params: Promise<{ userId: string }> };

// PATCH /api/admin/users/[userId] — update email, password, or name
export async function PATCH(request: Request, { params }: Params) {
  await requireAdmin();
  const { userId } = await params;
  const body = await request.json();
  const admin = createServiceClient();

  const authUpdate: { email?: string; password?: string } = {};
  if (body.email)    authUpdate.email    = body.email;
  if (body.password) authUpdate.password = body.password;

  if (Object.keys(authUpdate).length) {
    const { error } = await admin.auth.admin.updateUserById(userId, authUpdate);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (body.name !== undefined) {
    await admin.from("profiles").update({ name: body.name }).eq("id", userId);
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/users/[userId] — permanently delete a user
export async function DELETE(_request: Request, { params }: Params) {
  await requireAdmin();
  const { userId } = await params;
  const admin = createServiceClient();

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
