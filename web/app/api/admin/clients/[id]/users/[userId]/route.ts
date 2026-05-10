import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

type Params = { params: Promise<{ id: string; userId: string }> };

// DELETE /api/admin/clients/[id]/users/[userId] — remove portal user (deletes auth account)
export async function DELETE(_request: Request, { params }: Params) {
  await requireAdmin();
  const { userId } = await params;
  const admin = createServiceClient();

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
