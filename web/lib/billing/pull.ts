// Billing pull orchestrator.
// Called by the cron route. Iterates all active API configs, fetches billing
// data from each provider, and upserts into billing_snapshots.

import { createServiceClient, getVaultSecret } from "@/lib/supabase/service";
import { pullAnthropicBilling } from "./providers/anthropic";
import { pullVercelBilling }    from "./providers/vercel";
import { pullSupabaseBilling }  from "./providers/supabase-provider";

export interface PullResult {
  configId:  string;
  clientId:  string;
  provider:  string;
  status:    "success" | "skipped" | "error";
  message?:  string;
  amountCents?: number;
}

// Pull billing for all active configs for the given period.
// Defaults to the previous calendar month if no dates are provided.
export async function pullAllBilling(
  periodStart?: Date,
  periodEnd?: Date
): Promise<PullResult[]> {
  const { start, end } = resolvePeriod(periodStart, periodEnd);
  const supabase = createServiceClient();

  const { data: configs, error } = await supabase
    .from("client_api_configs")
    .select("id, client_id, provider, external_id, vault_secret_name, display_name")
    .eq("is_active", true);

  if (error) throw new Error(`Failed to load API configs: ${error.message}`);
  if (!configs?.length) return [];

  const results = await Promise.allSettled(
    configs.map((config) => pullOneConfig(config, start, end))
  );

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          configId: configs[i].id,
          clientId: configs[i].client_id,
          provider: configs[i].provider,
          status:   "error" as const,
          message:  r.reason instanceof Error ? r.reason.message : String(r.reason),
        }
  );
}

// Pull and upsert a single API config.
async function pullOneConfig(
  config: {
    id: string;
    client_id: string;
    provider: string;
    external_id: string;
    vault_secret_name: string | null;
    display_name: string;
  },
  periodStart: Date,
  periodEnd: Date
): Promise<PullResult> {
  const base = { configId: config.id, clientId: config.client_id, provider: config.provider };

  if (!config.vault_secret_name) {
    return { ...base, status: "skipped", message: "No vault secret configured" };
  }

  const credential = await getVaultSecret(config.vault_secret_name);
  if (!credential) {
    return { ...base, status: "skipped", message: "Vault secret not found" };
  }

  let result;
  switch (config.provider) {
    case "anthropic":
      result = await pullAnthropicBilling(config.external_id, credential, periodStart, periodEnd);
      break;
    case "vercel":
      result = await pullVercelBilling(config.external_id, credential, periodStart, periodEnd);
      break;
    case "supabase":
      result = await pullSupabaseBilling(config.external_id, credential, periodStart, periodEnd);
      break;
    default:
      return { ...base, status: "skipped", message: `Unknown provider: ${config.provider}` };
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("billing_snapshots")
    .upsert(
      {
        client_id:     config.client_id,
        api_config_id: config.id,
        provider:      config.provider,
        period_start:  periodStart.toISOString().slice(0, 10),
        period_end:    periodEnd.toISOString().slice(0, 10),
        amount_cents:  result.amountCents,
        currency:      result.currency,
        raw_data:      result.rawData,
        pulled_at:     new Date().toISOString(),
      },
      { onConflict: "api_config_id,period_start,period_end" }
    );

  if (error) throw new Error(`Failed to upsert snapshot: ${error.message}`);

  // Write audit log entry.
  await supabase.from("audit_log").insert({
    action:        "billing_pull",
    resource_type: "billing_snapshot",
    client_id:     config.client_id,
    metadata: {
      provider:    config.provider,
      external_id: config.external_id,
      period_start: periodStart.toISOString().slice(0, 10),
      period_end:   periodEnd.toISOString().slice(0, 10),
      amount_cents: result.amountCents,
    },
  });

  return { ...base, status: "success", amountCents: result.amountCents };
}

// Resolve billing period — defaults to the current calendar month (1st → last day).
// Running daily, this upserts the same month record each time with fresh MTD spend.
function resolvePeriod(start?: Date, end?: Date): { start: Date; end: Date } {
  if (start && end) return { start, end };

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return { start: firstOfMonth, end: lastOfMonth };
}
