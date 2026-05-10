// Anthropic usage billing provider.
// Pulls token usage and cost for a given org across a date range.
//
// API ref: https://docs.anthropic.com/en/api/usage
// Endpoint: GET https://api.anthropic.com/v1/organizations/{organization_id}/usage
// Auth header: x-api-key: <api_key>
// Query params: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)

export interface BillingResult {
  amountCents: number;
  currency: string;
  rawData: Record<string, unknown>;
}

export async function pullAnthropicBilling(
  orgId: string,
  apiKey: string,
  periodStart: Date,
  periodEnd: Date
): Promise<BillingResult> {
  const startDate = periodStart.toISOString().slice(0, 10);
  const endDate   = periodEnd.toISOString().slice(0, 10);

  const url = new URL(`https://api.anthropic.com/v1/organizations/${orgId}/usage`);
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);

  const res = await fetch(url.toString(), {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic billing API ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    total_cost_usd?: number;
    data?: Array<{ cost_usd?: number }>;
  };

  // API returns total_cost_usd directly, or sum across model breakdown.
  const totalUsd = data.total_cost_usd
    ?? data.data?.reduce((sum, row) => sum + (row.cost_usd ?? 0), 0)
    ?? 0;

  return {
    amountCents: Math.round(totalUsd * 100),
    currency: "usd",
    rawData: data as Record<string, unknown>,
  };
}
