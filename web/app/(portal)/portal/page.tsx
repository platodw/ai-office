import { requireClientUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ticketStatusLabel } from "@/lib/support/status-labels";

export default async function PortalHome() {
  const { clientId } = await requireClientUser();
  const supabase = await createClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const monthLabel = now.toLocaleString("default", { month: "long", year: "numeric" });

  const [
    { data: client },
    { data: invoices },
    { data: tickets },
    { data: apiSnapshots },
  ] = await Promise.all([
    supabase.from("clients").select("name, status").eq("id", clientId).single(),
    supabase
      .from("invoices")
      .select("id, invoice_number, status, total_cents, due_date, stripe_payment_url")
      .eq("client_id", clientId)
      .in("status", ["sent", "overdue"])
      .order("due_date"),
    supabase
      .from("support_tickets")
      .select("id, title, status, created_at")
      .eq("client_id", clientId)
      .not("status", "in", '("closed","resolved")')
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("billing_snapshots")
      .select("id, provider, amount_cents, pulled_at, client_api_configs(display_name)")
      .eq("client_id", clientId)
      .eq("period_start", monthStart)
      .eq("period_end", monthEnd)
      .order("amount_cents", { ascending: false }),
  ]);

  const apiTotal = apiSnapshots?.reduce((s, r) => s + r.amount_cents, 0) ?? 0;
  const pulledAt = apiSnapshots?.[0]?.pulled_at;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text mb-1">Welcome back</h1>
        <p className="text-sm text-muted">{client?.name} · AI Office portal</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <QuickAction
          href="/portal/chat"
          icon={<ChatIcon />}
          label="Chat with AI"
          description="Ask anything about your setup"
          primary
        />
        <QuickAction
          href="/portal/support/new"
          icon={<TicketIcon />}
          label="Open a ticket"
          description="Report an issue or request help"
        />
        <QuickAction
          href="/portal/billing"
          icon={<BillingIcon />}
          label="Billing"
          description="Invoices and API costs"
        />
      </div>

      {/* Dashboard cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">

        {/* API costs this month */}
        <div className="bg-surface-2 border border-border rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text">API costs</h2>
            <a href="/portal/billing" className="text-xs text-primary-dark hover:underline">Details</a>
          </div>
          <p className="text-xs text-muted mb-4">{monthLabel}</p>

          {!apiSnapshots?.length ? (
            <p className="text-xs text-muted flex-1">No data yet for this month.</p>
          ) : (
            <div className="flex-1">
              <div className="text-3xl font-bold text-text mb-1">
                ${(apiTotal / 100).toFixed(2)}
              </div>
              <p className="text-xs text-muted mb-4">month-to-date total</p>
              <ul className="space-y-1.5">
                {apiSnapshots.map((s) => {
                  const config = s.client_api_configs as unknown as { display_name: string } | null;
                  return (
                    <li key={s.id} className="flex items-center justify-between">
                      <span className="text-xs text-muted capitalize">
                        {config?.display_name ?? s.provider}
                      </span>
                      <span className="text-xs font-medium text-text">
                        ${(s.amount_cents / 100).toFixed(2)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {pulledAt && (
            <p className="text-[10px] text-muted mt-4">
              Updated {new Date(pulledAt).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Outstanding invoices */}
        <div className="bg-surface-2 border border-border rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text">Outstanding invoices</h2>
            <a href="/portal/billing" className="text-xs text-primary-dark hover:underline">View all</a>
          </div>
          {!invoices?.length ? (
            <p className="text-xs text-muted flex-1">No outstanding invoices. You&apos;re all caught up.</p>
          ) : (
            <ul className="space-y-3 flex-1">
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
          <a
            href="/portal/billing"
            className="mt-4 block text-center text-xs font-semibold bg-text text-bg py-2 rounded-lg hover:bg-text-2 transition-colors"
          >
            Go to billing
          </a>
        </div>

        {/* Open support tickets */}
        <div className="bg-surface-2 border border-border rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text">Open tickets</h2>
            <a href="/portal/support" className="text-xs text-primary-dark hover:underline">View all</a>
          </div>
          {!tickets?.length ? (
            <p className="text-xs text-muted flex-1">No open tickets. Everything looks good.</p>
          ) : (
            <ul className="space-y-2 flex-1">
              {tickets.map((t) => (
                <li key={t.id}>
                  <a href={`/portal/support/${t.id}`} className="flex items-center justify-between py-1 group">
                    <span className="text-sm text-text group-hover:text-primary-dark transition-colors truncate mr-2">{t.title}</span>
                    <span className="text-[10px] font-semibold text-muted shrink-0">{ticketStatusLabel(t.status)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <a
            href="/portal/support/new"
            className="mt-4 block text-center text-xs font-semibold border border-border-2 text-text py-2 rounded-lg hover:border-text transition-colors"
          >
            Open a support ticket
          </a>
        </div>

      </div>
    </div>
  );
}

function QuickAction({
  href, icon, label, description, primary,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      className={`flex flex-col gap-2 rounded-xl p-4 border transition-colors ${
        primary
          ? "bg-primary text-white border-primary hover:bg-primary-dark"
          : "bg-surface-2 border-border hover:border-text/20 text-text"
      }`}
    >
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${primary ? "bg-white/15" : "bg-surface"}`}>
        {icon}
      </span>
      <div>
        <div className={`text-sm font-semibold ${primary ? "text-white" : "text-text"}`}>{label}</div>
        <div className={`text-xs mt-0.5 ${primary ? "text-white/70" : "text-muted"}`}>{description}</div>
      </div>
    </a>
  );
}

function ChatIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
    </svg>
  );
}

function BillingIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}
