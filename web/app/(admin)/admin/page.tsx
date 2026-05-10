import { createClient } from "@/lib/supabase/server";

export default async function AdminOverview() {
  const supabase = await createClient();

  const [
    { count: clientCount },
    { count: openTickets },
    { count: unpaidInvoices },
  ] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("support_tickets").select("*", { count: "exact", head: true }).in("status", ["open", "waiting_on_dan"]),
    supabase.from("invoices").select("*", { count: "exact", head: true }).in("status", ["sent", "overdue"]),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-text mb-1">Overview</h1>
      <p className="text-sm text-muted mb-8">AI Office operations dashboard</p>

      <div className="grid grid-cols-3 gap-4 mb-10">
        <StatCard label="Active clients" value={clientCount ?? 0} href="/admin/clients" />
        <StatCard label="Open support tickets" value={openTickets ?? 0} href="/admin/support" alert={(openTickets ?? 0) > 0} />
        <StatCard label="Unpaid invoices" value={unpaidInvoices ?? 0} href="/admin/billing" alert={(unpaidInvoices ?? 0) > 0} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <RecentClients />
        <RecentTickets />
      </div>
    </div>
  );
}

function StatCard({ label, value, href, alert = false }: { label: string; value: number; href: string; alert?: boolean }) {
  return (
    <a href={href} className="bg-surface-2 border border-border rounded-xl p-5 hover:border-border-2 transition-colors block">
      <div className={`text-3xl font-bold mb-1 ${alert && value > 0 ? "text-warning" : "text-text"}`}>{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </a>
  );
}

async function RecentClients() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, status, onboarded_at")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="bg-surface-2 border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text">Recent clients</h2>
        <a href="/admin/clients" className="text-xs text-primary-dark hover:underline">View all</a>
      </div>
      {!clients?.length ? (
        <p className="text-sm text-muted">No clients yet.</p>
      ) : (
        <ul className="space-y-2">
          {clients.map((c) => (
            <li key={c.id}>
              <a href={`/admin/clients/${c.id}`} className="flex items-center justify-between py-1.5 hover:opacity-75 transition-opacity">
                <span className="text-sm text-text">{c.name}</span>
                <StatusBadge status={c.status} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function RecentTickets() {
  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, title, status, priority, created_at, clients(name)")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="bg-surface-2 border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text">Recent support tickets</h2>
        <a href="/admin/support" className="text-xs text-primary-dark hover:underline">View all</a>
      </div>
      {!tickets?.length ? (
        <p className="text-sm text-muted">No tickets yet.</p>
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id} className="py-1.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm text-text leading-tight">{t.title}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {(t.clients as unknown as { name: string } | null)?.name}
                  </div>
                </div>
                <StatusBadge status={t.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active:          "bg-success/10 text-success",
  onboarding:      "bg-primary-soft text-primary-dark",
  offboarding:     "bg-warning/10 text-warning",
  churned:         "bg-surface text-muted",
  open:            "bg-warning/10 text-warning",
  ai_answered:     "bg-primary-soft text-primary-dark",
  waiting_on_dan:  "bg-error/10 text-error",
  resolved:        "bg-success/10 text-success",
  closed:          "bg-surface text-muted",
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-surface text-muted";
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${style}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
