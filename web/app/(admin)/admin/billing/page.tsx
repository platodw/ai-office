import { createClient } from "@/lib/supabase/server";

export default async function AdminBilling({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client: clientFilter } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("invoices")
    .select("id, invoice_number, status, total_cents, issued_date, due_date, paid_at, clients(id, name)")
    .order("issued_date", { ascending: false });

  if (clientFilter) query = query.eq("client_id", clientFilter);

  const { data: invoices } = await query;

  const total = invoices?.reduce((sum, inv) => sum + inv.total_cents, 0) ?? 0;
  const unpaid = invoices?.filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, inv) => sum + inv.total_cents, 0) ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-text mb-1">Billing</h1>
      <p className="text-sm text-muted mb-8">All client invoices and infrastructure costs</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <SummaryCard label="Total invoiced" value={`$${(total / 100).toFixed(2)}`} />
        <SummaryCard label="Outstanding" value={`$${(unpaid / 100).toFixed(2)}`} warn={unpaid > 0} />
        <SummaryCard label="Invoices" value={String(invoices?.length ?? 0)} />
      </div>

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
                    {(inv.clients as { name: string } | null)?.name ?? "—"}
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
  paid:     "bg-success/10 text-success",
  sent:     "bg-primary-soft text-primary-dark",
  overdue:  "bg-error/10 text-error",
  draft:    "bg-surface text-muted",
  void:     "bg-surface text-muted",
};

function InvoiceBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${INVOICE_STYLES[status] ?? "bg-surface text-muted"}`}>
      {status}
    </span>
  );
}
