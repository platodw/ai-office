// Anthropic usage billing provider.
// Pulls cost data for an organization using the Admin API cost report.
//
// API ref: https://docs.anthropic.com/en/api/admin-api/usage-cost/get-cost-report
// Endpoint: GET https://api.anthropic.com/v1/organizations/cost_report
// Auth: x-api-key: <admin_api_key>  (must be an Admin API key: sk-ant-admin...)
// Note: orgId param is not used in the URL — the admin key scopes to the org.

export interface BillingResult {
  amountCents: number;
  currency: string;
  rawData: Record<string, unknown>;
}

export async function pullAnthropicBilling(
  _orgId: string,
  adminApiKey: string,
  periodStart: Date,
  periodEnd: Date
): Promise<BillingResult> {
  const url = new URL("https://api.anthropic.com/v1/organizations/cost_report");
  url.searchParams.set("starting_at", periodStart.toISOString());
  url.searchParams.set("ending_at", periodEnd.toISOString());

  const res = await fetch(url.toString(), {
    headers: {
      "x-api-key": adminApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic billing API ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    data?: Array<{
      results?: Array<{ amount?: string; currency?: string }>;
    }>;
  };

  // amount is in lowest currency units (cents) as a decimal string.
  let totalCents = 0;
  for (const bucket of data.data ?? []) {
    for (const result of bucket.results ?? []) {
      totalCents += parseFloat(result.amount ?? "0");
    }
  }

  return {
    amountCents: Math.round(totalCents),
    currency: "usd",
    rawData: data as Record<string, unknown>,
  };
}
