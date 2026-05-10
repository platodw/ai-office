"use client";
import { useState } from "react";
import Link from "next/link";

type PortalUser = {
  id: string;
  user_id: string;
  portal_role: string;
  created_at: string;
  profiles: { name: string | null; email: string } | null;
};

const ROLE_LABELS: Record<string, string> = {
  power_user: "Power User",
  billing:    "Billing",
  viewer:     "Viewer",
};

export default function PortalUsersPanel({ clientId, initial }: { clientId: string; initial: PortalUser[] }) {
  const [users, setUsers]       = useState(initial);
  const [resetLink, setResetLink] = useState<{ email: string; link: string } | null>(null);

  async function sendReset(userId: string) {
    const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
    const data = await res.json();
    if (res.ok) setResetLink({ email: data.email, link: data.link });
  }

  async function removeUser(userId: string, email: string) {
    if (!confirm(`Remove ${email}? This permanently deletes their account.`)) return;
    const res = await fetch(`/api/admin/clients/${clientId}/users/${userId}`, { method: "DELETE" });
    if (res.ok) setUsers(prev => prev.filter(u => u.user_id !== userId));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-text">Portal users</h2>
          <p className="text-xs text-muted mt-0.5">Client accounts with access to the portal</p>
        </div>
        <Link href={`/admin/clients/${clientId}/users/new`} className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary-dark transition-colors">
          Add user
        </Link>
      </div>

      {resetLink && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold text-text mb-1">Password reset link for {resetLink.email}</p>
          <p className="text-xs text-muted mb-2">Copy and send this — expires in 1 hour.</p>
          <input readOnly value={resetLink.link} onClick={e => (e.target as HTMLInputElement).select()} className="w-full text-xs bg-surface border border-border rounded px-2 py-1.5 font-mono text-text cursor-text" />
          <button onClick={() => setResetLink(null)} className="mt-2 text-xs text-muted hover:text-text">Dismiss</button>
        </div>
      )}

      {!users.length ? (
        <p className="text-sm text-muted py-2">No portal users yet. <Link href={`/admin/clients/${clientId}/users/new`} className="text-primary-dark hover:underline">Add one</Link>.</p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Email</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Name</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Role</th>
                <th className="text-right px-4 py-2.5 text-xs text-muted font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-text">{u.profiles?.email ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{u.profiles?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] font-medium bg-primary-soft text-primary-dark px-2 py-0.5 rounded-full">
                      {ROLE_LABELS[u.portal_role] ?? u.portal_role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button onClick={() => sendReset(u.user_id)} className="text-xs text-primary-dark hover:underline">Reset password</button>
                    <button onClick={() => removeUser(u.user_id, u.profiles?.email ?? "")} className="text-xs text-error hover:underline">Remove</button>
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
