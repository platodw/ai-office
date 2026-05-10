// Vercel usage billing provider.
// Pulls charge data for a team using the FOCUS billing charges endpoint.
//
// API ref: https://vercel.com/docs/rest-api/billing/list-focus-billing-charges
// Endpoint: GET https://api.vercel.com/v1/billing/charges
// Auth: Authorization: Bearer <token>
// Note: Response is JSONL (newline-delimited JSON). BilledCost is in USD (not cents).
// external_id should be the team slug (e.g. "dan-platos-projects") or team_xxx ID.

import type { BillingResult } from "./anthropic";

export async function pullVercelBilling(
  teamSlugOrId: string,
  apiToken: string,
  periodStart: Date,
  periodEnd: Date
): Promise<BillingResult> {
  const url = new URL("https://api.vercel.com/v1/billing/charges");
  url.searchParams.set("from", periodStart.toISOString());
  url.searchParams.set("to", periodEnd.toISOString());
  if (teamSlugOrId.startsWith("team_")) {
    url.searchParams.set("teamId", teamSlugOrId);
  } else {
    url.searchParams.set("slug", teamSlugOrId);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel billing API ${res.status}: ${body}`);
  }

  // Response is JSONL — split on newlines and parse each line.
  type FocusCharge = { BilledCost?: number; BillingCurrency?: string };
  const text = await res.text();
  const charges: FocusCharge[] = text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as FocusCharge);

  // BilledCost is in USD — convert to cents.
  const totalUsd = charges.reduce((sum, c) => sum + (c.BilledCost ?? 0), 0);

  return {
    amountCents: Math.round(totalUsd * 100),
    currency: charges[0]?.BillingCurrency?.toLowerCase() ?? "usd",
    rawData: { charges } as Record<string, unknown>,
  };
}
