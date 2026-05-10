import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Returns billing snapshots for a client+period, used by the new-invoice form
// to reload suggestions when the selected client changes.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const clientId    = searchParams.get("client");
  const periodStart = searchParams.get("period_start");
  const periodEnd   = searchParams.get("period_end");

  if (!clientId || !periodStart || !periodEnd) {
    return NextResponse.json({ error: "client, period_start, and period_end are required" }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("billing_snapshots")
    .select("id, provider, amount_cents, period_start, period_end, client_api_configs(display_name)")
    .eq("client_id", clientId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
