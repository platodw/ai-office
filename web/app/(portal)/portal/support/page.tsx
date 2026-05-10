import { requireClientUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function PortalSupport() {
  const { clientId } = await requireClientUser();
  const supabase = await createClient();

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, title, status, priority, created_at, updated_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  const open   = tickets?.filter((t) => !["closed", "resolved"].includes(t.status)) ?? [];
  const closed = tickets?.filter((t) => ["closed", "resolved"].includes(t.status)) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-text">Support</h1>
        <Link
          href="/portal/support/new"
          className="bg-text text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-text-2 transition-colors"
        >
          New ticket
        </Link>
      </div>
      <p className="text-sm text-muted mb-8">
        Ask a question about your setup or report an issue with one of your apps.
      </p>

      {!tickets?.length ? (
        <div className="bg-surface-2 border border-border rounded-xl p-8 text-center">
          <p className="text-sm text-muted mb-4">No support tickets yet.</p>
          <Link href="/portal/support/new" className="text-sm font-semibold text-primary-dark hover:underline">
            Open your first ticket
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <TicketGroup title="Open" tickets={open} />
          )}
          {closed.length > 0 && (
            <TicketGroup title="Resolved" tickets={closed} muted />
          )}
        </div>
      )}
    </div>
  );
}

type Ticket = { id: string; title: string; status: string; priority: string; created_at: string; updated_at: string };

function TicketGroup({ title, tickets, muted = false }: { title: string; tickets: Ticket[]; muted?: boolean }) {
  return (
    <div>
      <h2 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${muted ? "text-muted" : "text-text-2"}`}>{title}</h2>
      <div className="bg-surface-2 border border-border rounded-xl divide-y divide-border overflow-hidden">
        {tickets.map((t) => (
          <Link
            key={t.id}
            href={`/portal/support/${t.id}`}
            className="flex items-center justify-between px-5 py-4 hover:bg-surface/50 transition-colors block"
          >
            <div>
              <div className={`text-sm font-medium ${muted ? "text-muted" : "text-text"}`}>{t.title}</div>
              <div className="text-xs text-muted mt-0.5">
                Opened {new Date(t.created_at).toLocaleDateString()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PriorityDot priority={t.priority} />
              <StatusBadge status={t.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
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
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[status] ?? "bg-surface text-muted"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-error", high: "bg-warning", normal: "bg-muted", low: "bg-border-2",
};
function PriorityDot({ priority }: { priority: string }) {
  return <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_COLORS[priority] ?? "bg-border-2"}`} />;
}
