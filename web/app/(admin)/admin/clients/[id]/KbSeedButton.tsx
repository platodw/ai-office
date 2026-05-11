"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function KbSeedButton({ clientId, articleCount }: { clientId: string; articleCount: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult]   = useState<{ count: number; repo_readmes_used: number } | null>(null);
  const [error, setError]     = useState("");

  async function run() {
    if (running) return;
    const confirmed = articleCount > 0
      ? confirm(`This client already has ${articleCount} seeded articles. Re-seeding will replace them. Continue?`)
      : true;
    if (!confirmed) return;

    setRunning(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/kb/seed`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "request failed"); return; }
      setResult(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-text">Knowledge base</h2>
        <button
          onClick={run}
          disabled={running}
          className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
        >
          {running ? "Generating…" : articleCount > 0 ? "Re-seed KB" : "Seed KB"}
        </button>
      </div>
      <p className="text-xs text-muted">
        {articleCount > 0
          ? `${articleCount} seeded article${articleCount === 1 ? "" : "s"} on file for this client.`
          : "Generate per-client knowledge base articles from the data on this page plus repo READMEs."}
      </p>
      {result && (
        <p className="text-xs text-success mt-2">
          Created {result.count} article{result.count === 1 ? "" : "s"}
          {result.repo_readmes_used > 0 && ` (used ${result.repo_readmes_used} repo README${result.repo_readmes_used === 1 ? "" : "s"})`}.
        </p>
      )}
      {error && <p className="text-xs text-error mt-2">{error}</p>}
    </div>
  );
}
