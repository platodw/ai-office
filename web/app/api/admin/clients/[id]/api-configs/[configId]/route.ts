import { NextRequest, NextResponse } from "next/server";
import { createClient }        from "@/lib/supabase/server";
import { createServiceClient, storeVaultSecret } from "@/lib/supabase/service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; configId: string }> }
) {
  const { id: clientId, configId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { display_name?: string; external_id?: string; api_key?: string; is_active?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const svc = createServiceClient();

  // Fetch existing config to get current vault_secret_name and provider.
  const { data: existing, error: fetchErr } = await svc
    .from("client_api_configs")
    .select("vault_secret_name, provider, external_id")
    .eq("id", configId)
    .eq("client_id", clientId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  // If a new API key was provided, update (or create) the vault secret.
  let vaultSecretName = existing.vault_secret_name;
  if (body.api_key?.trim()) {
    const externalId = body.external_id ?? existing.external_id;
    const slug = externalId.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 40);
    vaultSecretName = `client_${clientId}_${existing.provider}_${slug}`;
    await storeVaultSecret(vaultSecretName, body.api_key.trim());
  }

  const updates: Record<string, unknown> = { vault_secret_name: vaultSecretName };
  if (body.display_name !== undefined) updates.display_name = body.display_name;
  if (body.external_id  !== undefined) updates.external_id  = body.external_id;
  if (body.is_active    !== undefined) updates.is_active    = body.is_active;

  const { error } = await svc
    .from("client_api_configs")
    .update(updates)
    .eq("id", configId)
    .eq("client_id", clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
