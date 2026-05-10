"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STATUSES = ["planning", "active", "maintenance", "deprecated"] as const;

type App = {
  id?: string;
  name: string;
  status: string;
  production_url: string;
  staging_url: string;
  repo_url: string;
  hosting: string;
  tech_stack: string;
  launched_at: string;
  notes: string;
};

export default function AppForm({ clientId, initial }: { clientId: string; initial?: App }) {
  const router = useRouter();
  const editing = !!initial?.id;

  const [form, setForm] = useState<App>({
    name:           initial?.name           ?? "",
    status:         initial?.status         ?? "active",
    production_url: initial?.production_url ?? "",
    staging_url:    initial?.staging_url    ?? "",
    repo_url:       initial?.repo_url       ?? "",
    hosting:        initial?.hosting        ?? "",
    tech_stack:     initial?.tech_stack     ?? "",
    launched_at:    initial?.launched_at    ?? "",
    notes:          initial?.notes          ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  function set(field: keyof App) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");

    const url    = editing ? `/api/admin/clients/${clientId}/apps/${initial!.id}` : `/api/admin/clients/${clientId}/apps`;
    const method = editing ? "PATCH" : "POST";
    const body   = { ...form, launched_at: form.launched_at || null };

    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    router.push(`/admin/clients/${clientId}`);
    router.refresh();
  }

  const input = "w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors";

  return (
    <form onSubmit={handleSubmit} className="bg-surface-2 border border-border rounded-xl p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs text-muted mb-1.5">App name <span className="text-error">*</span></label>
          <input type="text" value={form.name} onChange={set("name")} required className={input} placeholder="Imperial Plastics Portal" />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">Status</label>
          <select value={form.status} onChange={set("status")} className={input}>
            {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">Tech stack</label>
          <input type="text" value={form.tech_stack} onChange={set("tech_stack")} className={input} placeholder="Next.js + Supabase" />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">Production URL</label>
          <input type="url" value={form.production_url} onChange={set("production_url")} className={input} placeholder="https://app.example.com" />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">Staging URL</label>
          <input type="url" value={form.staging_url} onChange={set("staging_url")} className={input} placeholder="https://staging.example.com" />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">Repository</label>
          <input type="url" value={form.repo_url} onChange={set("repo_url")} className={input} placeholder="https://github.com/org/repo" />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">Hosting</label>
          <input type="text" value={form.hosting} onChange={set("hosting")} className={input} placeholder="Vercel" />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">Launch date</label>
          <input type="date" value={form.launched_at} onChange={set("launched_at")} className={input} />
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-muted mb-1.5">Notes</label>
          <textarea value={form.notes} onChange={set("notes")} rows={3} className={input} placeholder="Anything worth noting..." />
        </div>
      </div>

      {error && <p className="text-xs text-error">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={saving} className="bg-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors">
          {saving ? "Saving…" : editing ? "Save changes" : "Add app"}
        </button>
        <Link href={`/admin/clients/${clientId}`} className="text-sm text-muted hover:text-text py-2">Cancel</Link>
      </div>
    </form>
  );
}
