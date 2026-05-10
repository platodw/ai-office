import { createClient } from "@/lib/supabase/server";

export default async function AdminBilling({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client: clientFilter } = await searchParams;
  const supabase = await createClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const monthLabel = now.toLocaleString("default", { month: "long", year: "numeric" });

  let invoiceQuery = supabase
    .from("invoices")
    .select("id, invoice_number, status, total_cents, issued_date, due_date, paid_at, clients(id, name)")
    .order("issued_date", { ascending: false });
  if (clientFilter) invoiceQuery = invoiceQuery.eq("client_id", clientFilter);

  let snapshotQuery = supabase
    .from("billing_snapshots")
    .select("id, client_id, provider, amount_cents, period_start, pulled_at, clients(id, name), client_api_configs(display_name)")
    .eq("period_start", monthStart)
    .eq("period_end", monthEnd)
    .order("amount_cents", { ascending: false });
  if (clientFilter) snapshotQuery = snapshotQuery.eq("client_id", clientFilter);

  const [{ data: invoices }, { data: snapshots }] = await Promise.all([invoiceQuery, snapshotQuery]);

  const invoiceTotal  = invoices?.reduce((s, i) => s + i.total_cents, 0) ?? 0;
  const invoiceUnpaid = invoices?.filter(i => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + i.total_cents, 0) ?? 0;
  const apiTotal = snapshots?.reduce((s, r) => s + r.amount_cents, 0) ?? 0;

  // Group snapshots by client for the summary view.
  type Snap = NonNullable<typeof snapshots>[number];
  const byClient: Record<string, { name: string; rows: Snap[]; total: number }> = {};
  for (const s of snapshots ?? []) {
    const client = s.clients as unknown as { id: string; name: string } | null;
    const cid = s.client_id;
    if (!byClient[cid]) byClient[cid] = { name: client?.name ?? "Unknown", rows: [], total: 0 };
    byClient[cid].rows.push(s);
    byClient[cid].total += s.amount_cents;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text mb-1">Billing</h1>
      <p className="text-sm text-muted mb-8">Invoices and live API infrastructure costs</p>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Total invoiced" value={`$${(invoiceTotal / 100).toFixed(2)}`} />
        <SummaryCard label="Outstanding" value={`$${(invoiceUnpaid / 100).toFixed(2)}`} warn={invoiceUnpaid > 0} />
        <SummaryCard label={`API costs (${monthLabel})`} value={`$${(apiTotal / 100).toFixed(2)}`} />
        <SummaryCard label="Open invoices" value={String(invoices?.filter(i => i.status !== "paid" && i.status !== "void").length ?? 0)} />
      </div>

      {/* API costs this month */}
      <div className="bg-surface-2 border border-border rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text">API costs — {monthLabel}</h2>
          <p className="text-xs text-muted mt-0.5">Pulled daily from provider billing APIs. Updates each morning.</p>
        </div>
        {!snapshots?.length ? (
          <div className="p-8 text-center text-sm text-muted">
            No API cost data yet. Data appears after the first daily pull runs.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {Object.entries(byClient).map(([, group]) => (
              <div key={group.name} className="px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-text">{group.name}</span>
                  <span className="text-sm font-semibold text-text">${(group.total / 100).toFixed(2)}</span>
                </div>
                <div className="space-y-1">
                  {group.rows.map(s => {
                    const config = s.client_api_configs as unknown as { display_name: string } | null;
                    return (
                      <div key={s.id} className="flex items-center justify-between">
                        <span className="text-xs text-muted capitalize">
                          {s.provider}{config ? ` — ${config.display_name}` : ""}
                        </span>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-muted">
                            updated {new Date(s.pulled_at).toLocaleDateString()}
                          </span>
                          <span className="text-xs font-medium text-text">${(s.amount_cents / 100).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Invoices</h2>
          <a href="/admin/billing/new" className="text-xs bg-text text-bg font-semibold px-3 py-1.5 rounded-lg hover:bg-text-2 transition-colors">
            New invoice
          </a>
        </div>
        {!invoices?.length ? (
          <div className="p-8 text-center text-sm text-muted">No invoices found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted">Invoice</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted">Client</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted">Due</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-surface/50 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-xs text-text">{inv.invoice_number}</td>
                  <td className="px-5 py-3.5 text-text">
                    {(inv.clients as unknown as { name: string } | null)?.name ?? "—"}
                  </td>
                  <td className="px-5 py-3.5"><InvoiceBadge status={inv.status} /></td>
                  <td className="px-5 py-3.5 text-muted">
                    {new Date(inv.due_date).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-text">
                    ${(inv.total_cents / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-surface-2 border border-border rounded-xl p-5">
      <div className={`text-2xl font-bold mb-1 ${warn ? "text-warning" : "text-text"}`}>{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

const INVOICE_STYLES: Record<string, string> = {
  paid:    "bg-success/10 text-success",
  sent:    "bg-primary-soft text-primary-dark",
  overdue: "bg-error/10 text-error",
  draft:   "bg-surface text-muted",
  void:    "bg-surface text-muted",
};

function InvoiceBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${INVOICE_STYLES[status] ?? "bg-surface text-muted"}`}>
      {status}
    </span>
  );
}
