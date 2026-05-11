"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Article = {
  id: string;
  title: string;
  category: string | null;
  tags: string[];
  source: string | null;
  is_published: boolean;
  created_at: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  apps: "bg-primary-soft text-primary-dark",
  account: "bg-surface text-muted",
  billing: "bg-warning/10 text-warning",
  how_to: "bg-success/10 text-success",
  tech: "bg-primary/10 text-primary-dark",
};

export default function KbArticlesPanel({
  clientId,
  initial,
}: {
  clientId: string;
  initial: Article[];
}) {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>(initial);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function seed() {
    if (seeding) return;
    const hasArticles = articles.length > 0;
    if (hasArticles && !confirm(`This client already has ${articles.length} article${articles.length === 1 ? "" : "s"}. Re-seeding will replace all seeded ones. Continue?`)) return;
    setSeeding(true);
    setSeedError("");
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/kb/seed`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setSeedError(data.error ?? "Seeding failed."); return; }
      router.refresh();
    } catch (e) {
      setSeedError(e instanceof Error ? e.message : "Seeding failed.");
    } finally {
      setSeeding(false);
    }
  }

  async function deleteArticle(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/kb/${id}`, { method: "DELETE" });
      if (res.ok) {
        setArticles((prev) => prev.filter((a) => a.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text">Knowledge base</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={seed}
            disabled={seeding}
            className="text-xs border border-border text-muted px-3 py-1.5 rounded-lg hover:text-text hover:border-text/30 disabled:opacity-50 transition-colors"
          >
            {seeding ? "Generating…" : articles.length > 0 ? "Re-seed KB" : "Seed KB"}
          </button>
          <a
            href={`/admin/clients/${clientId}/kb/new`}
            className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary-dark transition-colors"
          >
            New article
          </a>
        </div>
      </div>

      {seedError && <p className="text-xs text-error mb-3">{seedError}</p>}

      {articles.length === 0 ? (
        <p className="text-xs text-muted">
          No articles yet. Seed from client data or create one manually.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {articles.map((a) => (
            <li key={a.id} className="py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-text truncate">{a.title}</span>
                  {!a.is_published && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-surface text-muted border border-border">draft</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {a.category && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[a.category] ?? "bg-surface text-muted"}`}>
                      {a.category}
                    </span>
                  )}
                  {a.source === "seeded" && (
                    <span className="text-[10px] text-muted">auto-generated</span>
                  )}
                  {a.tags.length > 0 && (
                    <span className="text-[10px] text-muted">{a.tags.join(", ")}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 mt-0.5">
                <a
                  href={`/admin/clients/${clientId}/kb/${a.id}/edit`}
                  className="text-xs text-muted hover:text-text transition-colors"
                >
                  Edit
                </a>
                <button
                  onClick={() => deleteArticle(a.id, a.title)}
                  disabled={deletingId === a.id}
                  className="text-xs text-error/70 hover:text-error disabled:opacity-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
