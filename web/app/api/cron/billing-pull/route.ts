// Vercel Cron endpoint — pulls billing for all active API configs.
// Vercel sends: Authorization: Bearer <CRON_SECRET>
// Schedule: daily at 06:00 UTC (configured in vercel.json)

import { NextRequest, NextResponse } from "next/server";
import { pullAllBilling } from "@/lib/billing/pull";

export const maxDuration = 300; // 5 min — billing pulls may be slow

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await pullAllBilling();

    const summary = {
      total:   results.length,
      success: results.filter((r) => r.status === "success").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors:  results.filter((r) => r.status === "error").length,
    };

    return NextResponse.json({ ok: true, summary, results });
  } catch (err) {
    console.error("[billing-pull] Fatal error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
