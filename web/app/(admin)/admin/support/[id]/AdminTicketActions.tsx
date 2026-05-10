"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "open",           label: "Open" },
  { value: "waiting_on_dan", label: "Waiting on me" },
  { value: "ai_answered",    label: "AI answered" },
  { value: "resolved",       label: "Resolved" },
  { value: "closed",         label: "Closed" },
];

export default function AdminTicketActions({
  ticketId,
  status,
}: {
  ticketId: string;
  status:   string;
}) {
  const router = useRouter();
  const [reply, setReply]         = useState("");
  const [sending, setSending]     = useState(false);
  const [newStatus, setNewStatus] = useState(status);
  const [error, setError]         = useState<string | null>(null);

  const isClosed = ["resolved", "closed"].includes(status);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || sending) return;
    setError(null);
    setSending(true);

    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ content: reply }),
      });
      if (!res.ok) throw new Error("Failed to send");
      setReply("");
      router.refresh();
    } catch {
      setError("Couldn't send reply.");
    } finally {
      setSending(false);
    }
  }

  async function handleStatusChange(val: string) {
    setNewStatus(val);
    await fetch(`/api/support/tickets/${ticketId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: val }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Status control */}
      <div className="flex items-center gap-3 bg-surface-2 border border-border rounded-xl px-4 py-3">
        <span className="text-sm text-muted">Status</span>
        <select
          value={newStatus}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Reply form */}
      {!isClosed && (
        <form onSubmit={handleReply} className="bg-surface-2 border border-border rounded-xl p-4">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Reply to client…"
            rows={4}
            className="w-full bg-transparent text-sm text-text placeholder:text-muted focus:outline-none resize-none"
          />
          {error && <p className="text-xs text-error mt-2">{error}</p>}
          <div className="flex justify-end mt-3">
            <button
              type="submit"
              disabled={sending || !reply.trim()}
              className="bg-text text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-text-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? "Sending…" : "Send reply"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
