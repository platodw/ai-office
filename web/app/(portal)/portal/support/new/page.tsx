"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewTicket() {
  const router = useRouter();
  const [title, setTitle]       = useState("");
  const [body, setBody]         = useState("");
  const [priority, setPriority] = useState("normal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/support/tickets", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title, body, priority }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to submit ticket");
      }

      const { ticketId } = await res.json();
      router.push(`/portal/support/${ticketId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text mb-1">New support ticket</h1>
        <p className="text-sm text-muted">
          Describe your question or issue. Our AI assistant will try to answer right away.
          If it can't, we'll follow up directly.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-text mb-1.5" htmlFor="title">
            Subject
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief description of your issue"
            required
            className="w-full bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1.5" htmlFor="body">
            Details
          </label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Explain what you're trying to do, what's happening, and any error messages you see."
            required
            rows={7}
            className="w-full bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1.5" htmlFor="priority">
            Priority
          </label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="low">Low — general question</option>
            <option value="normal">Normal — something isn't working right</option>
            <option value="high">High — a key workflow is broken</option>
            <option value="urgent">Urgent — blocking all work</option>
          </select>
        </div>

        {error && (
          <p className="text-sm text-error">{error}</p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={submitting || !title.trim() || !body.trim()}
            className="bg-text text-bg text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-text-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Submitting…" : "Submit ticket"}
          </button>
          <a
            href="/portal/support"
            className="text-sm text-muted hover:text-text transition-colors"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
