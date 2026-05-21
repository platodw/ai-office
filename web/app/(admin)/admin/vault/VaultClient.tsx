"use client";
import { useState } from "react";

type Client = { id: string; name: string };
type VaultEntry = {
  id: string;
  label: string;
  service: string;
  notes: string | null;
  client_id: string | null;
  created_at: string;
  clients: { id: string; name: string } | null;
};

export default function VaultClient({
  initialEntries,
  clients,
}: {
  initialEntries: VaultEntry[];
  clients: Client[];
}) {
  const [entries, setEntries] = useState<VaultEntry[]>(initialEntries);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [copying, setCopying] = useState<string | null>(null);
  const [form, setForm] = useState({
    label: "",
    service: "",
    secret_value: "",
    client_id: "",
    notes: "",
  });

  async function createEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim() || !form.service.trim() || !form.secret_value.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: form.label,
        service: form.service,
        secret_value: form.secret_value,
        client_id: form.client_id || null,
        notes: form.notes || null,
      }),
    });
    if (res.ok) {
      const entry = await res.json();
      setEntries([entry, ...entries]);
      setForm({ label: "", service: "", secret_value: "", client_id: "", notes: "" });
      setShowForm(false);
    }
    setSaving(false);
  }

  async function revealEntry(id: string) {
    if (revealed[id]) {
      const next = { ...revealed };
      delete next[id];
      setRevealed(next);
      return;
    }
    const res = await fetch(`/api/admin/vault/${id}/reveal`);
    if (res.ok) {
      const { value } = await res.json();
      setRevealed({ ...revealed, [id]: value });
    }
  }

  async function copyEntry(id: string) {
    let value = revealed[id];
    if (!value) {
      const res = await fetch(`/api/admin/vault/${id}/reveal`);
      if (!res.ok) return;
      value = (await res.json()).value;
    }
    await navigator.clipboard.writeText(value);
    setCopying(id);
    setTimeout(() => setCopying(null), 1500);
  }

  async function deleteEntry(id: string) {
    if (!confirm("Permanently delete this credential? This cannot be undone.")) return;
    await fetch(`/api/admin/vault/${id}`, { method: "DELETE" });
    setEntries(entries.filter((e) => e.id !== id));
    const next = { ...revealed };
    delete next[id];
    setRevealed(next);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text mb-1">Credential Vault</h1>
          <p className="text-sm text-muted">
            API keys and secrets, encrypted at rest. Admin-only access.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary-dark text-white text-sm px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          + Add Credential
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={createEntry}
          className="bg-surface-2 border border-border rounded-xl p-5 mb-6"
        >
          <h2 className="text-sm font-semibold text-text mb-4">New credential</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-muted mb-1">Label *</label>
              <input
                required
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary-dark"
                placeholder='e.g. "OpenAI Production Key"'
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Service *</label>
              <input
                required
                value={form.service}
                onChange={(e) => setForm({ ...form, service: e.target.value })}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary-dark"
                placeholder='e.g. "OpenAI"'
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-muted mb-1">Secret value *</label>
              <input
                required
                type="password"
                value={form.secret_value}
                onChange={(e) => setForm({ ...form, secret_value: e.target.value })}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text font-mono focus:outline-none focus:border-primary-dark"
                placeholder="Paste the API key or secret"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Client</label>
              <select
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary-dark"
              >
                <option value="">AI Office (General)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Notes</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary-dark"
                placeholder="Optional notes"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary-dark text-white text-sm px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Encrypting…" : "Save credential"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-muted hover:text-text px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {entries.length === 0 ? (
        <div className="bg-surface-2 border border-border rounded-xl p-10 text-center">
          <p className="text-sm text-muted">No credentials stored yet.</p>
        </div>
      ) : (
        <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-muted font-medium px-4 py-3">Service</th>
                <th className="text-left text-xs text-muted font-medium px-4 py-3">Label</th>
                <th className="text-left text-xs text-muted font-medium px-4 py-3">Client</th>
                <th className="text-left text-xs text-muted font-medium px-4 py-3">Value</th>
                <th className="text-left text-xs text-muted font-medium px-4 py-3">Added</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={`${
                    i < entries.length - 1 ? "border-b border-border" : ""
                  } hover:bg-surface transition-colors`}
                >
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-text">{entry.service}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-text">{entry.label}</div>
                    {entry.notes && (
                      <div className="text-xs text-muted mt-0.5">{entry.notes}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {entry.clients?.name ?? <span className="italic">AI Office</span>}
                  </td>
                  <td className="px-4 py-3">
                    {revealed[entry.id] ? (
                      <code className="text-xs font-mono text-text bg-surface px-2 py-1 rounded break-all">
                        {revealed[entry.id]}
                      </code>
                    ) : (
                      <span className="text-sm text-muted font-mono tracking-widest">········</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {new Date(entry.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 justify-end">
                      <button
                        onClick={() => revealEntry(entry.id)}
                        className="text-xs text-muted hover:text-text transition-colors"
                      >
                        {revealed[entry.id] ? "Hide" : "Reveal"}
                      </button>
                      <button
                        onClick={() => copyEntry(entry.id)}
                        className="text-xs text-muted hover:text-text transition-colors"
                      >
                        {copying === entry.id ? "Copied!" : "Copy"}
                      </button>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="text-xs text-muted hover:text-error transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
