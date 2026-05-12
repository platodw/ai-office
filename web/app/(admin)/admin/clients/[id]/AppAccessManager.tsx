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

const ROLES = [
  { value: "leadership", label: "Leadership" },
  { value: "sales",      label: "Sales" },
  { value: "admin",      label: "Admin" },
];

export default function AppAccessManager({
  clientId,
  appId,
}: {
  clientId: string;
  appId: string;
}) {
  const [tab, setTab] = useState<"email" | "portal">("email");
  const [entries, setEntries] = useState<AccessEntry[]>([]);
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Email invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("leadership");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Portal user grant state
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

  async function inviteByEmail() {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteMsg(null);
    const res = await fetch(`/api/admin/clients/${clientId}/apps/${appId}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, app_role: inviteRole }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const wasInvited = (data as { invited?: boolean }).invited;
      setInviteMsg({
        ok: true,
        text: wasInvited
          ? `Invite sent to ${inviteEmail}. They'll receive an email to set their password.`
          : `${inviteEmail} already had an account and has been granted access.`,
      });
      setInviteEmail("");
      load();
    } else {
      setInviteMsg({ ok: false, text: (data as { error?: string }).error ?? "Invite failed." });
    }
    setInviting(false);
  }

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
    await fetch(`/api/admin/clients/${clientId}/apps/${appId}/users/${accessId}`, { method: "DELETE" });
    load();
  }

  if (loading) return <p className="text-xs text-muted py-2">Loading&hellip;</p>;

  return (
    <div className="pt-3 mt-1">
      <p className="text-xs font-semibold text-text mb-2">App access</p>

      {/* Current access list */}
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

      {/* Grant access — tabbed */}
      <div className="border border-border rounded-lg overflow-hidden mt-2">
        <div className="flex border-b border-border text-xs">
          <button
            onClick={() => setTab("email")}
            className={`flex-1 px-3 py-2 font-medium transition-colors ${tab === "email" ? "bg-surface-2 text-text" : "text-muted hover:text-text"}`}
          >
            Invite by email
          </button>
          <button
            onClick={() => setTab("portal")}
            className={`flex-1 px-3 py-2 font-medium border-l border-border transition-colors ${tab === "portal" ? "bg-surface-2 text-text" : "text-muted hover:text-text"}`}
          >
            Existing portal user
          </button>
        </div>

        <div className="p-3 bg-surface-2 space-y-2">
          {tab === "email" ? (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && inviteByEmail()}
                  className="flex-1 text-xs border border-border rounded-lg px-2 py-1 bg-surface text-text focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="text-xs border border-border rounded-lg px-2 py-1 bg-surface text-text"
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <button
                  onClick={inviteByEmail}
                  disabled={inviting || !inviteEmail}
                  className="text-xs bg-primary text-white px-3 py-1 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  {inviting ? "Sending…" : "Invite"}
                </button>
              </div>
              {inviteMsg && (
                <p className={`text-xs ${inviteMsg.ok ? "text-success" : "text-error"}`}>{inviteMsg.text}</p>
              )}
              <p className="text-[11px] text-muted">
                New users receive a branded email to set their password. Existing users are granted access immediately.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="flex-1 text-xs border border-border rounded-lg px-2 py-1 bg-surface text-text"
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
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <button
                  onClick={grantAccess}
                  disabled={!selectedUserId || granting}
                  className="text-xs bg-primary text-white px-3 py-1 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  {granting ? "Granting…" : "Grant access"}
                </button>
              </div>
              {grantError && <p className="text-xs text-error mt-1">{grantError}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
