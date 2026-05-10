"use client";
import { useState } from "react";
import { Check, X, RefreshCw, ExternalLink, Loader2 } from "lucide-react";

type Suggestion = {
  id: string;
  step_id: string;
  field: string;
  current_value: string;
  proposed_value: string;
  rationale: string;
  triggering_question: string;
  confidence: number;
  status: "pending" | "approved" | "rejected" | "merged" | "failed";
  pr_url: string | null;
  pr_number: number | null;
  reviewer_notes: string | null;
  created_at: string;
};

export default function SuggestionList({ initial }: { initial: Suggestion[] }) {
  const [suggestions, setSuggestions] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string>("");

  const pending = suggestions.filter(s => s.status === "pending");
  const past = suggestions.filter(s => s.status !== "pending");

  async function generate() {
    setGenerating(true);
    setGenerateMsg("");
    try {
      const res = await fetch("/api/admin/generate-suggestions", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setGenerateMsg(`Error: ${data.error || "unknown"}`);
        return;
      }
      setGenerateMsg(
        data.suggestions > 0
          ? `Found ${data.suggestions} new suggestion${data.suggestions === 1 ? "" : "s"} from ${data.analyzed} questions.`
          : `Analyzed ${data.analyzed} questions, no clear suggestions.`,
      );
      if (data.suggestions > 0) location.reload();
    } catch (err) {
      setGenerateMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGenerating(false);
    }
  }

  async function approve(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/suggestions/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(`Couldn't deploy: ${data.error || "unknown"}`);
        location.reload();
        return;
      }
      setSuggestions(s =>
        s.map(x => x.id === id
          ? { ...x, status: (data.merged ? "merged" : "approved") as Suggestion["status"], pr_url: data.pr_url, pr_number: data.pr_number }
          : x,
        ),
      );
    } finally {
      setBusy(null);
    }
  }

  async function reject(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/admin/suggestions/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setSuggestions(s =>
        s.map(x => x.id === id ? { ...x, status: "rejected" as const } : x),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-2 bg-text hover:bg-text-2 text-bg font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {generating ? "Analyzing…" : "Generate suggestions"}
        </button>
        {generateMsg && <span className="text-sm text-muted">{generateMsg}</span>}
      </div>

      {pending.length === 0 && past.length === 0 && (
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted text-sm">
          No suggestions yet. Click Generate once you have some chat telemetry.
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text mb-3">Pending ({pending.length})</h2>
          <div className="space-y-3">
            {pending.map(s => (
              <SuggestionCard
                key={s.id}
                s={s}
                busy={busy === s.id}
                onApprove={() => approve(s.id)}
                onReject={() => reject(s.id)}
              />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text mb-3">Past ({past.length})</h2>
          <div className="space-y-3">
            {past.map(s => <SuggestionCard key={s.id} s={s} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  s,
  busy = false,
  onApprove,
  onReject,
}: {
  s: Suggestion;
  busy?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const isPending = s.status === "pending";

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-xs bg-surface-2 border border-border px-2 py-0.5 rounded font-mono">{s.step_id}</code>
          <code className="text-xs text-muted">{s.field}</code>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            s.confidence === 5 ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
          }`}>
            confidence {s.confidence}
          </span>
        </div>
        <StatusBadge status={s.status} />
      </div>

      <div className="text-xs text-muted mb-1">User asked:</div>
      <div className="bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text mb-3 italic">
        &ldquo;{s.triggering_question}&rdquo;
      </div>

      <div className="text-xs text-muted mb-1">Rationale:</div>
      <p className="text-sm text-text mb-4">{s.rationale}</p>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <div>
          <div className="text-xs text-muted mb-1">Current</div>
          <div className="bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text font-mono whitespace-pre-wrap">
            {s.current_value}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted mb-1">Proposed</div>
          <div className="bg-primary-soft border border-primary/30 rounded-lg px-3 py-2 text-sm text-text font-mono whitespace-pre-wrap">
            {s.proposed_value}
          </div>
        </div>
      </div>

      {s.pr_url && (
        <a
          href={s.pr_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mb-3"
        >
          PR #{s.pr_number} <ExternalLink size={11} />
        </a>
      )}

      {s.reviewer_notes && (
        <div className="text-xs text-error bg-error/10 border border-error/30 rounded px-2 py-1 mb-3">
          {s.reviewer_notes}
        </div>
      )}

      {isPending && onApprove && onReject && (
        <div className="flex gap-2">
          <button
            onClick={onApprove}
            disabled={busy}
            className="inline-flex items-center gap-1.5 bg-text hover:bg-text-2 text-bg font-semibold px-3 py-1.5 rounded-md text-xs transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Approve & deploy
          </button>
          <button
            onClick={onReject}
            disabled={busy}
            className="inline-flex items-center gap-1.5 bg-transparent border border-border hover:border-error text-text font-semibold px-3 py-1.5 rounded-md text-xs transition-colors disabled:opacity-50"
          >
            <X size={12} />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Suggestion["status"] }) {
  const styles = {
    pending: "bg-warning/20 text-warning",
    approved: "bg-success/20 text-success",
    merged: "bg-success/20 text-success",
    rejected: "bg-muted/20 text-muted",
    failed: "bg-error/20 text-error",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}
