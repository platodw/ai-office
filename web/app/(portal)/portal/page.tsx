import { requireClientUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ticketStatusLabel } from "@/lib/support/status-labels";

export default async function PortalHome() {
  const { clientId } = await requireClientUser();
  const supabase = await createClient();

  const [
    { data: client },
    { data: invoices },
    { data: tickets },
  ] = await Promise.all([
    supabase.from("clients").select("name, status").eq("id", clientId).single(),
    supabase.from("invoices").select("id, invoice_number, status, total_cents, due_date")
      .eq("client_id", clientId).in("status", ["sent", "overdue"]).order("due_date"),
    supabase.from("support_tickets").select("id, title, status, created_at")
      .eq("client_id", clientId).not("status", "in", '("closed","resolved")')
      .order("created_at", { ascending: false }).limit(3),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-text mb-1">Welcome back</h1>
      <p className="text-sm text-muted mb-8">{client?.name} · AI Office portal</p>

      <div className="grid sm:grid-cols-2 gap-5">

        {/* Outstanding invoices */}
        <div className="bg-surface-2 border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text">Outstanding invoices</h2>
            <a href="/portal/billing" className="text-xs text-primary-dark hover:underline">View all</a>
          </div>
          {!invoices?.length ? (
            <p className="text-xs text-muted">No outstanding invoices. You&apos;re all caught up.</p>
          ) : (
            <ul className="space-y-3">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-text">{inv.invoice_number}</div>
                    <div className="text-xs text-muted">Due {new Date(inv.due_date).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-text">${(inv.total_cents / 100).toFixed(2)}</div>
                    <span className={`text-[10px] font-semibold ${inv.status === "overdue" ? "text-error" : "text-primary-dark"}`}>
                      {inv.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <a href="/portal/billing" className="mt-4 block text-center text-xs font-semibold bg-text text-bg py-2 rounded-lg hover:bg-text-2 transition-colors">
            Go to billing
          </a>
        </div>

        {/* Open support tickets */}
        <div className="bg-surface-2 border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text">Open support tickets</h2>
            <a href="/portal/support" className="text-xs text-primary-dark hover:underline">View all</a>
          </div>
          {!tickets?.length ? (
            <p className="text-xs text-muted">No open tickets. Everything looks good.</p>
          ) : (
            <ul className="space-y-2">
              {tickets.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-1">
                  <span className="text-sm text-text">{t.title}</span>
                  <span className="text-[10px] font-semibold text-muted">{ticketStatusLabel(t.status)}</span>
                </li>
              ))}
            </ul>
          )}
          <a href="/portal/support/new" className="mt-4 block text-center text-xs font-semibold border border-border-2 text-text py-2 rounded-lg hover:border-text transition-colors">
            Open a support ticket
          </a>
        </div>
      </div>
    </div>
  );
}
