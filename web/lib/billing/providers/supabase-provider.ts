// Supabase project usage billing provider.
// Pulls compute, database, bandwidth, and storage usage for a project.
//
// API ref: https://api.supabase.com/api/v1#tag/projects/GET/v1/projects/{ref}/usage
// Endpoint: GET https://api.supabase.com/v1/projects/{projectRef}/usage
// Auth header: Authorization: Bearer <management_api_token>

import type { BillingResult } from "./anthropic";

export async function pullSupabaseBilling(
  projectRef: string,
  managementToken: string,
  periodStart: Date,
  periodEnd: Date
): Promise<BillingResult> {
  const startDate = periodStart.toISOString().slice(0, 10);
  const endDate   = periodEnd.toISOString().slice(0, 10);

  const url = new URL(`https://api.supabase.com/v1/projects/${projectRef}/usage`);
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date",   endDate);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${managementToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    // 401 usually means a service_role JWT was stored instead of a PAT.
    // The Supabase Management API requires a Personal Access Token from
    // supabase.com/dashboard/account/tokens, not a project service_role key.
    if (res.status === 401) {
      throw new Error(
        `Supabase usage API 401: credential must be a Personal Access Token (PAT) ` +
        `from supabase.com/dashboard/account/tokens, not a service_role key. Original: ${body}`
      );
    }
    throw new Error(`Supabase usage API ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    usage_billing_enabled?: boolean;
    compute?: { cost?: number };
    egress?: { cost?: number };
    storage?: { cost?: number };
    realtime?: { cost?: number };
  };

  // Sum across known metered dimensions. Each cost field is in USD.
  const totalUsd = (
    (data.compute?.cost  ?? 0) +
    (data.egress?.cost   ?? 0) +
    (data.storage?.cost  ?? 0) +
    (data.realtime?.cost ?? 0)
  );

  return {
    amountCents: Math.round(totalUsd * 100),
    currency: "usd",
    rawData: data as Record<string, unknown>,
  };
}
