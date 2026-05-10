// Vercel usage billing provider.
// Pulls compute, bandwidth, and edge function usage for a team.
//
// API ref: https://vercel.com/docs/rest-api/endpoints/billing
// Endpoint: GET https://api.vercel.com/v2/teams/{teamId}/billing/invoices
// Auth header: Authorization: Bearer <token>

import type { BillingResult } from "./anthropic";

export async function pullVercelBilling(
  teamId: string,
  apiToken: string,
  periodStart: Date,
  periodEnd: Date
): Promise<BillingResult> {
  // Vercel invoices endpoint returns a list of invoices for the billing period.
  // We find the invoice whose period overlaps our range and sum line items.
  const url = new URL(`https://api.vercel.com/v2/teams/${teamId}/billing/invoices`);
  url.searchParams.set("limit", "12");

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

  const data = await res.json() as {
    invoices?: Array<{
      periodStart?: number;
      periodEnd?: number;
      total?: number;
      currency?: string;
      items?: Array<{ total?: number }>;
    }>;
  };

  // Find the invoice that most closely matches the requested period.
  const startMs = periodStart.getTime();
  const endMs   = periodEnd.getTime();

  const matchingInvoice = data.invoices?.find((inv) => {
    const iStart = inv.periodStart ?? 0;
    const iEnd   = inv.periodEnd   ?? 0;
    return iStart <= endMs && iEnd >= startMs;
  });

  const totalCents = matchingInvoice?.total
    ? Math.round(matchingInvoice.total) // Vercel returns cents already
    : 0;

  return {
    amountCents: totalCents,
    currency: matchingInvoice?.currency ?? "usd",
    rawData: data as Record<string, unknown>,
  };
}
