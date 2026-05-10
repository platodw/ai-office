import { createClient } from "@/lib/supabase/server";
import NewInvoiceForm from "./NewInvoiceForm";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client: preselectedClientId } = await searchParams;
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("status", "active")
    .order("name");

  // Pre-load data for the preselected client so the form can suggest line items immediately.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  let preloadedServices: PreloadedService[] = [];
  let preloadedSnapshots: PreloadedSnapshot[] = [];

  if (preselectedClientId) {
    const [{ data: services }, { data: snapshots }] = await Promise.all([
      supabase
        .from("client_services")
        .select("id, name, description, type, amount_cents, invoiced_at")
        .eq("client_id", preselectedClientId)
        .eq("status", "active"),
      supabase
        .from("billing_snapshots")
        .select("id, provider, amount_cents, period_start, period_end, client_api_configs(display_name)")
        .eq("client_id", preselectedClientId)
        .eq("period_start", monthStart)
        .eq("period_end", monthEnd),
    ]);
    preloadedServices  = (services  ?? []) as PreloadedService[];
    preloadedSnapshots = (snapshots ?? []) as PreloadedSnapshot[];
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <a href="/admin/billing" className="text-xs text-muted hover:text-text transition-colors">
          ← Back to billing
        </a>
        <h1 className="text-2xl font-bold text-text mt-3 mb-1">New invoice</h1>
        <p className="text-sm text-muted">Create a draft invoice. Line items are pre-populated from active services and API costs.</p>
      </div>

      <NewInvoiceForm
        clients={clients ?? []}
        preselectedClientId={preselectedClientId ?? null}
        preloadedServices={preloadedServices}
        preloadedSnapshots={preloadedSnapshots}
        currentMonthStart={monthStart}
        currentMonthEnd={monthEnd}
      />
    </div>
  );
}

export interface PreloadedService {
  id: string;
  name: string;
  description: string | null;
  type: string;
  amount_cents: number;
  invoiced_at: string | null;
}

export interface PreloadedSnapshot {
  id: string;
  provider: string;
  amount_cents: number;
  period_start: string;
  period_end: string;
  client_api_configs: { display_name: string } | null;
}
