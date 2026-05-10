"use client";
import { useState } from "react";

type Suggestion = {
  name: string;
  status: string;
  production_url: string | null;
  staging_url: string | null;
  repo_url: string;
  hosting: string | null;
  tech_stack: string | null;
  launched_at: string | null;
  notes: string | null;
};

export default function ImportAppsButton({
  clientId,
  initialGithubOrg,
  onImported,
}: {
  clientId: string;
  initialGithubOrg: string | null;
  onImported: () => void;
}) {
  const [open, setOpen]               = useState(false);
  const [org, setOrg]                 = useState(initialGithubOrg ?? "");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected]       = useState<Set<number>>(new Set());
  const [saving, setSaving]           = useState(false);

  async function runImport() {
    if (!org.trim()) { setError("Enter a GitHub username or org"); return; }
    setLoading(true); setError(""); setSuggestions([]); setSelected(new Set());
    const res = await fetch(`/api/admin/clients/${clientId}/apps/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ github_org: org.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    setSuggestions(data.suggestions ?? []);
    setSelected(new Set((data.suggestions ?? []).map((_: Suggestion, i: number) => i)));
  }

  function toggle(i: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  async function saveSelected() {
    setSaving(true);
    const toSave = suggestions.filter((_, i) => selected.has(i));
    await Promise.all(toSave.map(s =>
      fetch(`/api/admin/clients/${clientId}/apps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      })
    ));
    setSaving(false);
    setOpen(false);
    setSuggestions([]);
    onImported();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted border border-border px-3 py-1.5 rounded-lg hover:text-text hover:border-border-2 transition-colors"
      >
        Import from GitHub
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-bg border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text">Import from GitHub</h2>
            <p className="text-xs text-muted mt-0.5">Claude will analyze repos and suggest apps to add</p>
          </div>
          <button onClick={() => setOpen(false)} className="text-muted hover:text-text text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-4 border-b border-border flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-muted mb-1.5">GitHub username or org</label>
            <input
              type="text"
              value={org}
              onChange={e => setOrg(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runImport()}
              placeholder="e.g. platodw or acme-corp"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <button
            onClick={runImport}
            disabled={loading}
            className="bg-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {loading ? "Analyzing…" : "Analyze repos"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && <p className="text-sm text-error mb-4">{error}</p>}

          {loading && (
            <div className="text-sm text-muted text-center py-8">
              Fetching repos and asking Claude to analyze them…
            </div>
          )}

          {!loading && suggestions.length === 0 && !error && (
            <p className="text-sm text-muted text-center py-8">
              Enter a GitHub username or org and click "Analyze repos" to get suggestions.
            </p>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted">{suggestions.length} app{suggestions.length !== 1 ? "s" : ""} found — select which to add</p>
                <button
                  onClick={() => setSelected(selected.size === suggestions.length ? new Set() : new Set(suggestions.map((_, i) => i)))}
                  className="text-xs text-primary-dark hover:underline"
                >
                  {selected.size === suggestions.length ? "Deselect all" : "Select all"}
                </button>
              </div>
              {suggestions.map((s, i) => (
                <label key={i} className={`flex gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${selected.has(i) ? "border-primary/40 bg-primary-soft/30" : "border-border bg-surface-2"}`}>
                  <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} className="mt-0.5 accent-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-text">{s.name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        s.status === "active" ? "bg-success/10 text-success" :
                        s.status === "planning" ? "bg-primary-soft text-primary-dark" :
                        s.status === "maintenance" ? "bg-warning/10 text-warning" :
                        "bg-surface text-muted"
                      }`}>{s.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      {s.tech_stack && <span className="text-xs text-muted">{s.tech_stack}</span>}
                      {s.hosting    && <span className="text-xs text-muted">· {s.hosting}</span>}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1.5">
                      {s.production_url && <a href={s.production_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-primary-dark hover:underline truncate max-w-[200px]">{s.production_url}</a>}
                      {s.repo_url && <a href={s.repo_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-muted hover:text-text truncate max-w-[200px]">{s.repo_url.replace("https://github.com/", "")}</a>}
                    </div>
                    {s.notes && <p className="text-xs text-muted mt-1 italic">{s.notes}</p>}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted">{selected.size} of {suggestions.length} selected</span>
            <div className="flex gap-3">
              <button onClick={() => setOpen(false)} className="text-sm text-muted hover:text-text">Cancel</button>
              <button
                onClick={saveSelected}
                disabled={saving || selected.size === 0}
                className="bg-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : `Add ${selected.size} app${selected.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
