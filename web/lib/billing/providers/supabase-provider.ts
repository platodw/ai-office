// Supabase project usage billing provider.
//
// NOTE: Supabase does not expose a per-project cost API. Billing is at the
// organization level and is mostly flat-rate (Pro = $25/mo + add-ons).
// This provider uses the project subscription endpoint to return the base
// plan cost. Variable usage (storage overages, egress, etc.) is not included.
//
// API ref: https://api.supabase.com/api/v1
// Endpoint: GET https://api.supabase.com/v1/projects/{ref}/subscription
// Auth: Authorization: Bearer <PAT>  (Personal Access Token, not service_role key)

import type { BillingResult } from "./anthropic";

const PLAN_MONTHLY_CENTS: Record<string, number> = {
  free:       0,
  pro:        2500,  // $25/mo
  team:       59900, // $599/mo
  enterprise: 0,     // custom pricing
};

export async function pullSupabaseBilling(
  projectRef: string,
  managementToken: string,
  _periodStart: Date,
  _periodEnd: Date
): Promise<BillingResult> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/subscription`, {
    headers: {
      Authorization: `Bearer ${managementToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) {
      throw new Error(
        `Supabase API 401: credential must be a Personal Access Token (PAT, sbp_...) ` +
        `from supabase.com/dashboard/account/tokens, not a service_role key. Raw: ${body}`
      );
    }
    throw new Error(`Supabase subscription API ${res.status}: ${body}`);
  }

  const data = await res.json() as { tier?: { key?: string } };
  const planKey = data?.tier?.key?.toLowerCase() ?? "unknown";
  const amountCents = PLAN_MONTHLY_CENTS[planKey] ?? 0;

  return {
    amountCents,
    currency: "usd",
    rawData: data as Record<string, unknown>,
  };
}
