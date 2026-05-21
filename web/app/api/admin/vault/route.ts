import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, storeVaultSecret, deleteVaultSecret } from "@/lib/supabase/service";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("credential_vault")
    .select("id, client_id, label, service, notes, created_at, clients(id, name)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { label, service, secret_value, client_id, notes } = body;
  if (!label?.trim()) return NextResponse.json({ error: "label is required" }, { status: 422 });
  if (!service?.trim()) return NextResponse.json({ error: "service is required" }, { status: 422 });
  if (!secret_value?.trim()) return NextResponse.json({ error: "secret_value is required" }, { status: 422 });

  const vaultName = `cred_${Date.now()}_${label.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 40)}`;

  try {
    await storeVaultSecret(vaultName, secret_value);
  } catch (e) {
    return NextResponse.json({ error: `Vault error: ${(e as Error).message}` }, { status: 500 });
  }

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("credential_vault")
    .insert({
      label: label.trim(),
      service: service.trim(),
      vault_secret_name: vaultName,
      client_id: client_id || null,
      notes: notes || null,
    })
    .select("id, client_id, label, service, notes, created_at, clients(id, name)")
    .single();

  if (error) {
    await deleteVaultSecret(vaultName);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
