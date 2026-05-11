"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Approval = {
  id: string;
  kind: string;
  tool_name: string;
  title: string;
  description: string | null;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
  clients: { name: string } | null;
  support_tickets: { id: string; title: string } | null;
};

export default function ApprovalRow({ approval }: { approval: Approval }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    if (busy) return;
    setBusy(decision);
    setError("");
    try {
      const res = await fetch(`/api/admin/approvals/${approval.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "request failed"); setBusy(null); return; }
      setResult(decision === "approve" ? `Approved · ${data.message ?? "done"}` : "Rejected");
      setTimeout(() => router.refresh(), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  return (
    <div className="bg-surface-2 border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="text-xs text-muted mb-1">
            {approval.clients?.name ?? "—"} · {new Date(approval.created_at).toLocaleString()}
          </div>
          <div className="text-sm font-semibold text-text">{approval.title}</div>
          {approval.description && (
            <div className="text-sm text-text-2 mt-1.5 whitespace-pre-wrap">{approval.description}</div>
          )}
          {Object.keys(approval.payload ?? {}).length > 0 && (
            <pre className="text-[11px] bg-surface border border-border rounded px-2 py-1.5 mt-2 font-mono text-text-2 overflow-x-auto">
              {JSON.stringify(approval.payload, null, 2)}
            </pre>
          )}
        </div>
        <span className="text-[10px] font-semibold bg-primary-soft text-primary-dark px-2 py-0.5 rounded-full shrink-0">
          {approval.tool_name}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => decide("approve")}
          disabled={!!busy}
          className="text-xs bg-success text-white px-3 py-1.5 rounded-lg hover:bg-success/90 disabled:opacity-50 transition-colors"
        >
          {busy === "approve" ? "Running…" : "Approve"}
        </button>
        <button
          onClick={() => decide("reject")}
          disabled={!!busy}
          className="text-xs border border-border text-text px-3 py-1.5 rounded-lg hover:bg-surface disabled:opacity-50 transition-colors"
        >
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </button>
        {approval.support_tickets && (
          <a
            href={`/admin/support/${approval.support_tickets.id}`}
            className="text-xs text-muted hover:text-text transition-colors ml-2"
          >
            View conversation →
          </a>
        )}
        {result && <span className="text-xs text-success ml-auto">{result}</span>}
        {error && <span className="text-xs text-error ml-auto">{error}</span>}
      </div>
    </div>
  );
}
