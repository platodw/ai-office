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

  const { data: messages } = await supabase
    .from("support_messages")
    .select("id, author_type, author_id, content, metadata, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

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
