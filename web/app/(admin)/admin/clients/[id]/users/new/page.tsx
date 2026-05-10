"use client";
import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const ROLES = [
  { value: "power_user", label: "Power User" },
  { value: "billing",    label: "Billing" },
  { value: "viewer",     label: "Viewer" },
];

export default function NewPortalUserPage() {
  const router = useRouter();
  const { id: clientId } = useParams<{ id: string }>();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [role, setRole]         = useState("power_user");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const res = await fetch(`/api/admin/clients/${clientId}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, portal_role: role }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    router.push(`/admin/clients/${clientId}`);
    router.refresh();
  }

  return (
    <div className="max-w-md">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link href="/admin/clients" className="text-muted hover:text-text">Clients</Link>
        <span className="text-muted">/</span>
        <Link href={`/admin/clients/${clientId}`} className="text-muted hover:text-text">Client</Link>
        <span className="text-muted">/</span>
        <span className="text-text">New portal user</span>
      </div>

      <h1 className="text-xl font-bold text-text mb-6">Add portal user</h1>

      <form onSubmit={handleSubmit} className="bg-surface-2 border border-border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-xs text-muted mb-1.5">Name (optional)</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">Temporary password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors" />
          <p className="text-[11px] text-muted mt-1">You can send them a password reset link after creating the account.</p>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">Portal role</label>
          <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors">
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {error && <p className="text-xs text-error">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={saving} className="bg-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors">
            {saving ? "Creating…" : "Create user"}
          </button>
          <Link href={`/admin/clients/${clientId}`} className="text-sm text-muted hover:text-text py-2">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
