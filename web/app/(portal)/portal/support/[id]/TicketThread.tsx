"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Message = {
  id:          string;
  author_type: string;
  content:     string;
  created_at:  string;
};

export default function TicketThread({
  ticketId,
  initialMessages,
  status,
}: {
  ticketId:        string;
  initialMessages: Message[];
  status:          string;
}) {
  const router   = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [reply, setReply]       = useState("");
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const isClosed = ["resolved", "closed"].includes(status);

  async function handleSend(e: React.FormEvent) {
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

      if (!res.ok) throw new Error("Failed to send message");

      const { message } = await res.json();
      setMessages((prev) => [...prev, message]);
      setReply("");
      router.refresh();
    } catch {
      setError("Couldn't send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      {/* Message thread */}
      <div className="space-y-4 mb-6">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      {/* Reply form */}
      {!isClosed && (
        <form onSubmit={handleSend} className="bg-surface-2 border border-border rounded-xl p-4">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Reply to this ticket…"
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

      {isClosed && (
        <p className="text-sm text-muted text-center py-4">This ticket is {status}.</p>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isClient = message.author_type === "client";
  const isSystem = message.author_type === "system";

  if (isSystem) {
    return (
      <div className="text-center">
        <span className="text-xs text-muted italic">{message.content}</span>
      </div>
    );
  }

  const bubbleClass = isClient
    ? "ml-auto bg-primary/10 border-primary/20"
    : "mr-auto bg-surface-2 border-border";

  const labelMap: Record<string, string> = {
    client: "You",
    ai:     "AI Office Assistant",
    admin:  "AI Office Team",
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
