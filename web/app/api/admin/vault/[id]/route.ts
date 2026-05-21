import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, deleteVaultSecret } from "@/lib/supabase/service";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const svc = createServiceClient();

  const { data: entry } = await svc
    .from("credential_vault")
    .select("vault_secret_name")
    .eq("id", id)
    .single();

  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteVaultSecret(entry.vault_secret_name);

  const { error } = await svc.from("credential_vault").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
