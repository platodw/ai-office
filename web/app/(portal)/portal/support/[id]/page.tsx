import { requireClientUser }   from "@/lib/auth";
import { createClient }        from "@/lib/supabase/server";
import { notFound, redirect }  from "next/navigation";
import TicketThread            from "./TicketThread";

type Params = { params: Promise<{ id: string }> };

export default async function PortalTicket({ params }: Params) {
  const { id } = await params;
  const { clientId } = await requireClientUser();
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, title, status, priority, created_at, client_id")
    .eq("id", id)
    .single();

  if (!ticket || ticket.client_id !== clientId) notFound();

  const { data: messages } = await supabase
    .from("support_messages")
    .select("id, author_type, content, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <a href="/portal/support" className="text-xs text-muted hover:text-text transition-colors">
          ← Back to support
        </a>
        <div className="flex items-start justify-between mt-3 gap-4">
          <h1 className="text-xl font-bold text-text leading-snug">{ticket.title}</h1>
          <StatusBadge status={ticket.status} />
        </div>
        <p className="text-xs text-muted mt-1">
          Opened {new Date(ticket.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      <TicketThread
        ticketId={ticket.id}
        initialMessages={messages ?? []}
        status={ticket.status}
      />
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
    <span className={`shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize whitespace-nowrap ${STATUS_STYLES[status] ?? "bg-surface text-muted"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
