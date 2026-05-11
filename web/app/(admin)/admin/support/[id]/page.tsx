import { requireAdmin }       from "@/lib/auth";
import { createClient }       from "@/lib/supabase/server";
import { notFound }           from "next/navigation";
import AdminTicketActions     from "./AdminTicketActions";
import { ticketStatusLabel }  from "@/lib/support/status-labels";

type Params = { params: Promise<{ id: string }> };

export default async function AdminTicket({ params }: Params) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, title, status, priority, created_at, updated_at, clients(name)")
    .eq("id", id)
    .single();

  if (!ticket) notFound();

  const [{ data: messages }, { data: investigation }] = await Promise.all([
    supabase
      .from("support_messages")
      .select("id, author_type, author_id, content, metadata, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("ticket_investigations")
      .select("id, status, summary, suggested_action, suggested_reply, suggested_change, pr_url, model, started_at, completed_at, error")
      .eq("ticket_id", id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const clientName = (ticket.clients as unknown as { name: string } | null)?.name ?? "Unknown";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <a href="/admin/support" className="text-xs text-muted hover:text-text transition-colors">
          ← Back to queue
        </a>
        <div className="flex items-start justify-between mt-3 gap-4">
          <div>
            <h1 className="text-xl font-bold text-text leading-snug">{ticket.title}</h1>
            <p className="text-sm text-muted mt-0.5">{clientName}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>
        </div>
        <p className="text-xs text-muted mt-2">
          Opened {new Date(ticket.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* Investigation panel — local Claude agent's findings */}
      {investigation && <InvestigationPanel inv={investigation} />}

      {/* Message thread */}
      <div className="space-y-4 mb-6">
        {(messages ?? []).map((m) => (
          <AdminMessageBubble key={m.id} message={m} />
        ))}
      </div>

      <AdminTicketActions ticketId={ticket.id} status={ticket.status} />
    </div>
  );
}

function AdminMessageBubble({ message }: {
  message: { id: string; author_type: string; content: string; created_at: string; metadata?: Record<string, unknown> | null }
}) {
  if (message.author_type === "system") {
    return (
      <div className="text-center">
        <span className="text-xs text-muted italic">{message.content}</span>
      </div>
    );
  }

  const isAdmin  = message.author_type === "admin";
  const isClient = message.author_type === "client";

  const bubbleClass = isAdmin
    ? "ml-auto bg-primary/10 border-primary/20"
    : isClient
    ? "mr-auto bg-surface-2 border-border"
    : "mr-auto bg-surface border-dashed border-primary/30"; // AI messages

  const labelMap: Record<string, string> = {
    client: "Client",
    ai:     "AI Assistant",
    admin:  "You",
  };

  return (
    <div className={`max-w-[85%] border rounded-xl px-4 py-3 ${bubbleClass}`}>
      <div className="flex items-center justify-between gap-4 mb-1.5">
        <span className="text-[11px] font-semibold text-muted">
          {labelMap[message.author_type] ?? message.author_type}
        </span>
        <span className="text-[10px] text-muted">
          {new Date(message.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <p className="text-sm text-text whitespace-pre-wrap">{message.content}</p>
    </div>
  );
}

type Investigation = {
  id: string;
  status: string;
  summary: string | null;
  suggested_action: string | null;
  suggested_reply: string | null;
  suggested_change: string | null;
  pr_url: string | null;
  model: string | null;
  started_at: string;
  completed_at: string | null;
  error: string | null;
};

const ACTION_LABEL: Record<string, string> = {
  reply_to_user: "Reply to user",
  request_info:  "Ask user for more info",
  fix_code:      "Code change",
  config_change: "Configuration change",
  no_action:     "No action needed",
};

function InvestigationPanel({ inv }: { inv: Investigation }) {
  const isRunning = inv.status === "running";
  const isFailed  = inv.status === "failed";
  const isDone    = inv.status === "done";

  return (
    <div className="mb-6 border border-primary/30 bg-primary-soft/30 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-primary-dark">
            Local agent investigation
          </div>
          <div className="text-xs text-muted mt-0.5">
            {inv.model ?? "claude"} · started {new Date(inv.started_at).toLocaleTimeString()}
            {inv.completed_at && ` · finished ${new Date(inv.completed_at).toLocaleTimeString()}`}
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          isRunning ? "bg-warning/10 text-warning" :
          isFailed  ? "bg-error/10 text-error" :
                      "bg-success/10 text-success"
        }`}>
          {inv.status}
        </span>
      </div>

      {isFailed && inv.error && (
        <p className="text-xs text-error whitespace-pre-wrap">{inv.error}</p>
      )}

      {isDone && (
        <div className="space-y-3">
          {inv.summary && (
            <div>
              <div className="text-xs font-semibold text-text mb-1">Findings</div>
              <p className="text-sm text-text whitespace-pre-wrap">{inv.summary}</p>
            </div>
          )}

          {inv.suggested_action && (
            <div>
              <div className="text-xs font-semibold text-text mb-1">
                Recommendation: {ACTION_LABEL[inv.suggested_action] ?? inv.suggested_action}
              </div>
              {inv.suggested_reply && (
                <div className="bg-surface border border-border rounded-lg p-3 text-sm text-text whitespace-pre-wrap mb-2">
                  {inv.suggested_reply}
                </div>
              )}
              {inv.suggested_change && (
                <div className="bg-surface border border-border rounded-lg p-3 text-sm text-text-2 whitespace-pre-wrap mb-2">
                  {inv.suggested_change}
                </div>
              )}
              {inv.pr_url && (
                <a href={inv.pr_url} target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-semibold text-primary-dark hover:underline">
                  View PR →
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {isRunning && (
        <p className="text-sm text-muted">Agent is investigating…</p>
      )}
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
    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[status] ?? "bg-surface text-muted"}`}>
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
