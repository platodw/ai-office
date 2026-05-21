import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, getVaultSecret } from "@/lib/supabase/service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; configId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: clientId, configId } = await params;
  const svc = createServiceClient();

  const { data: config } = await svc
    .from("client_api_configs")
    .select("vault_secret_name")
    .eq("id", configId)
    .eq("client_id", clientId)
    .single();

  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!config.vault_secret_name) return NextResponse.json({ error: "No key stored for this config" }, { status: 404 });

  const secret = await getVaultSecret(config.vault_secret_name);
  if (!secret) return NextResponse.json({ error: "Key not found in vault" }, { status: 404 });

  return NextResponse.json({ value: secret });
}
