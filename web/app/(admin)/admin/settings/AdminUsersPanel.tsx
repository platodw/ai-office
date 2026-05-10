"use client";
import { useState } from "react";

type AdminUser = { id: string; name: string | null; email: string; created_at: string };

export default function AdminUsersPanel({ initial }: { initial: AdminUser[] }) {
  const [users, setUsers]     = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]       = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [resetLink, setResetLink] = useState<{ email: string; link: string } | null>(null);

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    setUsers(prev => [...prev, { id: data.id, email: data.email, name: name || null, created_at: new Date().toISOString() }]);
    setEmail(""); setPassword(""); setName(""); setShowAdd(false);
    setSaving(false);
  }

  async function removeAdmin(userId: string) {
    if (!confirm("Remove this admin account? This permanently deletes the user.")) return;
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (res.ok) setUsers(prev => prev.filter(u => u.id !== userId));
  }

  async function sendReset(userId: string) {
    const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
    const data = await res.json();
    if (res.ok) setResetLink({ email: data.email, link: data.link });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-text">Admin accounts</h2>
        <button onClick={() => setShowAdd(v => !v)} className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary-dark transition-colors">
          {showAdd ? "Cancel" : "Add admin"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addAdmin} className="bg-surface border border-border rounded-xl p-5 mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-text mb-1">New admin account</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Name (optional)</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Temporary password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary" />
          </div>
          {error && <p className="text-xs text-error">{error}</p>}
          <button type="submit" disabled={saving} className="bg-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors">
            {saving ? "Creating…" : "Create admin"}
          </button>
        </form>
      )}

      {resetLink && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-4">
          <p className="text-xs text-text font-semibold mb-1">Password reset link for {resetLink.email}</p>
          <p className="text-xs text-muted mb-2">Copy and send this link — it expires in 1 hour.</p>
          <input readOnly value={resetLink.link} onClick={e => (e.target as HTMLInputElement).select()} className="w-full text-xs bg-surface border border-border rounded px-2 py-1.5 font-mono text-text cursor-text" />
          <button onClick={() => setResetLink(null)} className="mt-2 text-xs text-muted hover:text-text">Dismiss</button>
        </div>
      )}

      <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs text-muted font-medium">Email</th>
              <th className="text-left px-4 py-3 text-xs text-muted font-medium">Name</th>
              <th className="text-right px-4 py-3 text-xs text-muted font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-text">{u.email}</td>
                <td className="px-4 py-3 text-muted">{u.name ?? "—"}</td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button onClick={() => sendReset(u.id)} className="text-xs text-primary-dark hover:underline">Reset password</button>
                  <button onClick={() => removeAdmin(u.id)} className="text-xs text-error hover:underline">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
