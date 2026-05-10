import { NextRequest, NextResponse } from "next/server";
import { createClient }        from "@/lib/supabase/server";
import { createServiceClient, storeVaultSecret } from "@/lib/supabase/service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { provider: string; display_name: string; external_id: string; api_key?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { provider, display_name, external_id, api_key } = body;
  if (!provider || !display_name || !external_id) {
    return NextResponse.json({ error: "provider, display_name, and external_id are required" }, { status: 422 });
  }

  const validProviders = ["anthropic", "vercel", "supabase", "other"];
  if (!validProviders.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 422 });
  }

  const svc = createServiceClient();

  // Store API key in Vault if provided.
  let vaultSecretName: string | null = null;
  if (api_key?.trim()) {
    const slug = external_id.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 40);
    vaultSecretName = `client_${clientId}_${provider}_${slug}`;
    await storeVaultSecret(vaultSecretName, api_key.trim());
  }

  const { data, error } = await svc
    .from("client_api_configs")
    .insert({ client_id: clientId, provider, display_name, external_id, vault_secret_name: vaultSecretName })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: `Failed to save config: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ configId: data.id }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const configId = searchParams.get("configId");
  if (!configId) return NextResponse.json({ error: "configId required" }, { status: 422 });

  const svc = createServiceClient();

  // Fetch the vault secret name before deleting so we can clean up Vault.
  const { data: config } = await svc
    .from("client_api_configs")
    .select("vault_secret_name")
    .eq("id", configId)
    .eq("client_id", clientId)
    .single();

  const { error } = await svc
    .from("client_api_configs")
    .delete()
    .eq("id", configId)
    .eq("client_id", clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (config?.vault_secret_name) {
    const { deleteVaultSecret } = await import("@/lib/supabase/service");
    await deleteVaultSecret(config.vault_secret_name).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
