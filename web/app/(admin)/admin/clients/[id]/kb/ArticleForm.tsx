"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = ["apps", "account", "billing", "how_to", "tech"];

type ArticleFormProps = {
  clientId: string;
  articleId?: string;
  initial?: {
    title: string;
    content: string;
    category: string | null;
    tags: string[];
    is_published: boolean;
  };
};

export default function ArticleForm({ clientId, articleId, initial }: ArticleFormProps) {
  const router = useRouter();
  const isEdit = !!articleId;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [tagsRaw, setTagsRaw] = useState((initial?.tags ?? []).join(", "));
  const [isPublished, setIsPublished] = useState(initial?.is_published ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required.");
      return;
    }
    setSaving(true);
    setError("");

    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const body = { title, content, category: category || null, tags, is_published: isPublished };
    const url = isEdit
      ? `/api/admin/clients/${clientId}/kb/${articleId}`
      : `/api/admin/clients/${clientId}/kb`;
    const method = isEdit ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Request failed."); return; }
      router.push(`/admin/clients/${clientId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="block text-xs font-medium text-muted mb-1.5">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-sm bg-surface border border-border rounded-lg px-3 py-2 text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="How to log in to the client portal"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full text-sm bg-surface border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">— none —</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">Tags (comma-separated)</label>
          <input
            type="text"
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            className="w-full text-sm bg-surface border border-border rounded-lg px-3 py-2 text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="login, portal, access"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1.5">Content (Markdown)</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={18}
          className="w-full text-sm bg-surface border border-border rounded-lg px-3 py-2 text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono resize-y"
          placeholder="Write the article content here in Markdown..."
          required
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="published"
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
          className="rounded border-border text-primary focus:ring-primary/40"
        />
        <label htmlFor="published" className="text-xs text-text-2">Published (visible to portal users)</label>
      </div>

      {error && <p className="text-xs text-error">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="text-sm bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors font-medium"
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create article"}
        </button>
        <a
          href={`/admin/clients/${clientId}`}
          className="text-sm text-muted hover:text-text transition-colors"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
