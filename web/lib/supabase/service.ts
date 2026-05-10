import { createClient } from "@supabase/supabase-js";

// Service role client — server-side only. Never import this in browser code.
// Used for vault secret access and cron job writes.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role credentials not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Retrieve a secret from Supabase Vault by name.
// Uses an RPC wrapper because PostgREST can't query vault schema tables directly.
export async function getVaultSecret(name: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("admin_get_vault_secret", { p_name: name });
  if (error || !data) return null;
  return data as string;
}

// Store (or overwrite) a secret in Supabase Vault. Returns the secret UUID.
export async function storeVaultSecret(name: string, secret: string): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("admin_store_vault_secret", {
    p_name: name,
    p_secret: secret,
  });
  if (error) throw new Error(`Vault store failed: ${error.message}`);
  return data as string;
}

// Delete a secret from Supabase Vault by name.
export async function deleteVaultSecret(name: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.rpc("admin_delete_vault_secret", { p_name: name });
}
