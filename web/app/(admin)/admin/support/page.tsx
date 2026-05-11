import { createClient } from "@/lib/supabase/server";
import { ticketStatusLabel } from "@/lib/support/status-labels";

export default async function AdminSupport({ searchParams }: { searchParams: Promise<{ status?: string; client?: string }> }) {
  const { status: statusFilter, client: clientFilter } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("support_tickets")
    .select("id, title, status, priority, created_at, clients(id, name)")
    .eq("kind", "ticket")
    .order("created_at", { ascending: false });

  if (statusFilter) query = query.eq("status", statusFilter);
  else query = query.not("status", "in", '("closed")');
  if (clientFilter) query = query.eq("client_id", clientFilter);

  const { data: tickets } = await query;

  const statuses = ["open", "waiting_on_dan", "ai_answered", "resolved", "closed"];

  return (
    <div>
      <h1 className="text-2xl font-bold text-text mb-1">Support</h1>
      <p className="text-sm text-muted mb-6">Client help desk queue</p>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6">
        <FilterTab href="/admin/support" label="Active" active={!statusFilter} />
        {statuses.map((s) => (
          <FilterTab key={s} href={`/admin/support?status=${s}`} label={ticketStatusLabel(s)} active={statusFilter === s} />
        ))}
      </div>

      <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
        {!tickets?.length ? (
          <div className="p-8 text-center text-sm text-muted">No tickets found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted">Ticket</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted">Client</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted">Priority</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted">Opened</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tickets.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => window.location.href = `/admin/support/${t.id}`}
                  className="hover:bg-surface/50 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3.5 font-medium text-text">{t.title}</td>
                  <td className="px-5 py-3.5 text-muted">
                    {(t.clients as unknown as { name: string } | null)?.name ?? "—"}
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={t.status} /></td>
                  <td className="px-5 py-3.5"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-5 py-3.5 text-muted">
                    {new Date(t.created_at).toLocaleDateString()}
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

function FilterTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <a
      href={href}
      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
        active ? "bg-text text-bg" : "text-muted hover:text-text hover:bg-surface"
      }`}
    >
      {label}
    </a>
  );
}

const STATUS_STYLES: Record<string, string> = {
  open:           "bg-warning/10 text-warning",
  ai_answered:    "bg-primary-soft text-primary-dark",
  waiting_on_dan: "bg-error/10 text-error",
  resolved:       "bg-success/10 text-success",
  closed:         "bg-surface text-muted",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[status] ?? "bg-surface text-muted"}`}>
      {ticketStatusLabel(status)}
    </span>
  );
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "text-error font-bold", high: "text-warning font-semibold",
  normal: "text-muted", low: "text-muted",
};

function PriorityBadge({ priority }: { priority: string }) {
  return <span className={`text-xs capitalize ${PRIORITY_STYLES[priority] ?? "text-muted"}`}>{priority}</span>;
}
