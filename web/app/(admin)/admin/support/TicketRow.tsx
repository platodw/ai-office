"use client";
import { useRouter } from "next/navigation";
import { ticketStatusLabel } from "@/lib/support/status-labels";

type Ticket = {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  clients: { name: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  open:              "bg-warning/10 text-warning",
  ai_answered:       "bg-primary-soft text-primary-dark",
  waiting_on_dan:    "bg-error/10 text-error",
  awaiting_approval: "bg-error/10 text-error",
  resolved:          "bg-success/10 text-success",
  closed:            "bg-surface text-muted",
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "text-error font-bold", high: "text-warning font-semibold",
  normal: "text-muted", low: "text-muted",
};

export default function TicketRow({ ticket }: { ticket: Ticket }) {
  const router = useRouter();
  return (
    <tr
      onClick={() => router.push(`/admin/support/${ticket.id}`)}
      className="hover:bg-surface/50 transition-colors cursor-pointer"
    >
      <td className="px-5 py-3.5 font-medium text-text">{ticket.title}</td>
      <td className="px-5 py-3.5 text-muted">{ticket.clients?.name ?? "—"}</td>
      <td className="px-5 py-3.5">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[ticket.status] ?? "bg-surface text-muted"}`}>
          {ticketStatusLabel(ticket.status)}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <span className={`text-xs capitalize ${PRIORITY_STYLES[ticket.priority] ?? "text-muted"}`}>{ticket.priority}</span>
      </td>
      <td className="px-5 py-3.5 text-muted">{new Date(ticket.created_at).toLocaleDateString()}</td>
    </tr>
  );
}
