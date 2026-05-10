import { requireClientUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function PortalBilling() {
  const { clientId } = await requireClientUser();
  const supabase = await createClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const monthLabel = now.toLocaleString("default", { month: "long", year: "numeric" });

  const [{ data: invoices }, { data: currentSnapshots }, { data: pastSnapshots }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, status, total_cents, issued_date, due_date, stripe_payment_url, paid_at")
      .eq("client_id", clientId)
      .order("issued_date", { ascending: false }),
    supabase
      .from("billing_snapshots")
      .select("id, provider, amount_cents, pulled_at, client_api_configs(display_name)")
      .eq("client_id", clientId)
      .eq("period_start", monthStart)
      .eq("period_end", monthEnd)
      .order("amount_cents", { ascending: false }),
    supabase
      .from("billing_snapshots")
      .select("id, provider, period_start, period_end, amount_cents, client_api_configs(display_name)")
      .eq("client_id", clientId)
      .neq("period_start", monthStart)
      .order("period_start", { ascending: false })
      .limit(24),
  ]);

  const currentTotal = currentSnapshots?.reduce((s, r) => s + r.amount_cents, 0) ?? 0;
  const snapshots = pastSnapshots;

  return (
    <div>
      <h1 className="text-2xl font-bold text-text mb-1">Billing</h1>
      <p className="text-sm text-muted mb-8">Your invoices and AI infrastructure costs</p>

      {/* Invoices */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-text mb-4">Invoices</h2>
        <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
          {!invoices?.length ? (
            <div className="p-6 text-sm text-muted text-center">No invoices yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted">Invoice</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted">Issued</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted">Due</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted">Amount</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs text-text">{inv.invoice_number}</td>
                    <td className="px-5 py-3.5 text-muted">{new Date(inv.issued_date).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-muted">{new Date(inv.due_date).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-text">
                      ${(inv.total_cents / 100).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`text-[10px] font-semibold ${
                        inv.status === "paid" ? "text-success" :
                        inv.status === "overdue" ? "text-error" : "text-primary-dark"
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {inv.stripe_payment_url && inv.status !== "paid" && (
                        <a
                          href={inv.stripe_payment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold bg-text text-bg px-3 py-1.5 rounded-lg hover:bg-text-2 transition-colors"
                        >
                          Pay now
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Current month costs */}
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-base font-semibold text-text">API costs — {monthLabel}</h2>
          {currentSnapshots?.length ? (
            <span className="text-xs text-muted">
              Updated {new Date(currentSnapshots[0].pulled_at).toLocaleDateString()}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted mb-4">
          Actual costs from your AI providers, pulled daily and passed through to you at cost.
        </p>
        {!currentSnapshots?.length ? (
          <div className="bg-surface-2 border border-border rounded-xl p-6 text-sm text-muted text-center">
            No data yet for this month.
          </div>
        ) : (
          <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted">Provider</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted">MTD cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentSnapshots.map((s) => {
                  const config = s.client_api_configs as unknown as { display_name: string } | null;
                  return (
                    <tr key={s.id}>
                      <td className="px-5 py-3 font-medium text-text capitalize">
                        {s.provider}{config ? <span className="text-muted font-normal"> — {config.display_name}</span> : ""}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-text">
                        ${(s.amount_cents / 100).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-surface">
                  <td className="px-5 py-3 text-sm font-semibold text-text">Total</td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-text">
                    ${(currentTotal / 100).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Past months */}
      {snapshots?.length ? (
        <section>
          <h2 className="text-base font-semibold text-text mb-4">Previous months</h2>
          <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted">Provider</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted">Period</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {snapshots.map((s) => {
                  const config = s.client_api_configs as unknown as { display_name: string } | null;
                  return (
                    <tr key={s.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-5 py-3 font-medium text-text capitalize">
                        {s.provider}{config ? <span className="text-muted font-normal"> — {config.display_name}</span> : ""}
                      </td>
                      <td className="px-5 py-3 text-muted">
                        {new Date(s.period_start).toLocaleString("default", { month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-text">
                        ${(s.amount_cents / 100).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
