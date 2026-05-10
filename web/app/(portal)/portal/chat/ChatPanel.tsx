"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Msg = { id: string; author_type: string; content: string; created_at: string };

export default function ChatPanel({
  conversationId,
  initialMessages,
}: {
  conversationId: string | null;
  initialMessages: Msg[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput]       = useState("");
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset state when switching conversations.
  useEffect(() => { setMessages(initialMessages); }, [conversationId, initialMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setError("");
    setSending(true);

    const userMsg: Msg = {
      id: `local-${Date.now()}`,
      author_type: "client",
      content: input,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    const sentText = input;
    setInput("");

    try {
      const res = await fetch("/api/portal/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, message: sentText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "request failed");
        setSending(false);
        return;
      }
      setMessages((m) => [...m, {
        id: `local-ai-${Date.now()}`,
        author_type: "ai",
        content: data.response,
        created_at: new Date().toISOString(),
      }]);

      // If this was a new conversation, push to its URL so the sidebar updates.
      if (!conversationId && data.conversation_id) {
        router.push(`/portal/chat?c=${data.conversation_id}`);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border border-border rounded-xl bg-surface-2 flex flex-col h-[600px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
        {!messages.length && !sending && (
          <div className="text-center text-sm text-muted pt-12">
            Start a conversation. Ask about your setup, your deployed apps, or anything else.
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} role={m.author_type} content={m.content} />
        ))}
        {sending && (
          <Bubble role="ai" content="…" muted />
        )}
      </div>
      <form onSubmit={send} className="border-t border-border p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={sending ? "Thinking…" : "Type a message"}
          disabled={sending}
          className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="bg-text text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-text-2 disabled:opacity-50 transition-colors"
        >
          Send
        </button>
      </form>
      {error && <div className="px-4 pb-3 text-xs text-error">{error}</div>}
    </div>
  );
}

function Bubble({ role, content, muted = false }: { role: string; content: string; muted?: boolean }) {
  const isUser = role === "client";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
          isUser
            ? "bg-primary text-white"
            : `bg-surface text-text border border-border ${muted ? "opacity-60" : ""}`
        }`}
      >
        {content}
      </div>
    </div>
  );
}
