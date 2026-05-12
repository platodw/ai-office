"use client";
import { useState, useEffect, useCallback } from "react";

type AccessEntry = {
  id: string;
  user_id: string;
  external_user_id: string | null;
  status: "active" | "revoked";
  granted_at: string;
  profiles: { name: string | null; email: string } | null;
};

type PortalUser = {
  id: string;
  user_id: string;
  portal_role: string;
  profiles: { name: string | null; email: string } | null;
};

export default function AppAccessManager({
  clientId,
  appId,
}: {
  clientId: string;
  appId: string;
}) {
  const [entries, setEntries] = useState<AccessEntry[]>([]);
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [appRole, setAppRole] = useState("leadership");
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [accessRes, usersRes] = await Promise.all([
      fetch(`/api/admin/clients/${clientId}/apps/${appId}/users`),
      fetch(`/api/admin/clients/${clientId}/users`),
    ]);
    if (accessRes.ok) setEntries(await accessRes.json());
    if (usersRes.ok) setPortalUsers(await usersRes.json());
    setLoading(false);
  }, [clientId, appId]);

  useEffect(() => { load(); }, [load]);

  const grantedUserIds = new Set(entries.map(e => e.user_id));
  const availableUsers = portalUsers.filter(u => !grantedUserIds.has(u.user_id));

  async function grantAccess() {
    if (!selectedUserId) return;
    setGranting(true);
    setGrantError(null);
    const res = await fetch(`/api/admin/clients/${clientId}/apps/${appId}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: selectedUserId, app_role: appRole }),
    });
    setGranting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setGrantError((data as { error?: string }).error ?? "Failed to grant access");
    } else {
      setSelectedUserId("");
      load();
    }
  }

  async function revokeAccess(accessId: string) {
    await fetch(`/api/admin/clients/${clientId}/apps/${appId}/users/${accessId}`, {
      method: "DELETE",
    });
    load();
  }

  if (loading) return <p className="text-xs text-muted py-2">Loading&hellip;</p>;

  return (
    <div className="pt-3 mt-1">
      <p className="text-xs font-semibold text-text mb-2">App access</p>

      {entries.length === 0 ? (
        <p className="text-xs text-muted mb-3">No users provisioned to this app yet.</p>
      ) : (
        <ul className="space-y-1.5 mb-3">
          {entries.map(e => (
            <li key={e.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text">{e.profiles?.name ?? "—"}</span>
                <span className="text-xs text-muted">{e.profiles?.email}</span>
                {e.external_user_id ? (
                  <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full font-semibold">provisioned</span>
                ) : (
                  <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full font-semibold">manual</span>
                )}
              </div>
              <button
                onClick={() => revokeAccess(e.id)}
                className="text-[10px] font-semibold text-error hover:underline ml-4"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}

      {availableUsers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedUserId}
            onChange={e => setSelectedUserId(e.target.value)}
            className="text-xs border border-border rounded-lg px-2 py-1 bg-surface text-text"
          >
            <option value="">Add portal user&hellip;</option>
            {availableUsers.map(u => (
              <option key={u.user_id} value={u.user_id}>
                {u.profiles?.name ?? u.profiles?.email ?? u.user_id}
              </option>
            ))}
          </select>
          <select
            value={appRole}
            onChange={e => setAppRole(e.target.value)}
            className="text-xs border border-border rounded-lg px-2 py-1 bg-surface text-text"
          >
            <option value="leadership">Leadership</option>
            <option value="sales">Sales</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={grantAccess}
            disabled={!selectedUserId || granting}
            className="text-xs bg-primary text-white px-3 py-1 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {granting ? "Granting…" : "Grant access"}
          </button>
        </div>
      )}

      {grantError && <p className="text-xs text-error mt-2">{grantError}</p>}
    </div>
  );
}
