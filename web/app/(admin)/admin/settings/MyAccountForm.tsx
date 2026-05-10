"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function MyAccountForm({ userId, initialEmail }: { userId: string; initialEmail: string }) {
  const supabase = createClient();
  const [email, setEmail]           = useState(initialEmail);
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [saving, setSaving]         = useState(false);
  const [message, setMessage]       = useState("");
  const [error, setError]           = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(""); setError("");
    if (password && password !== confirm) { setError("Passwords don't match"); return; }
    if (password && password.length < 8)  { setError("Password must be at least 8 characters"); return; }

    setSaving(true);
    const update: { email?: string; password?: string } = {};
    if (email !== initialEmail) update.email = email;
    if (password) update.password = password;

    if (!Object.keys(update).length) { setMessage("No changes to save."); setSaving(false); return; }

    const { error: err } = await supabase.auth.updateUser(update);
    if (err) { setError(err.message); } else { setMessage("Saved."); setPassword(""); setConfirm(""); }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-xs text-muted mb-1.5">Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors" />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1.5">New password <span className="text-muted">(leave blank to keep current)</span></label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors" />
      </div>
      {password && (
        <div>
          <label className="block text-xs text-muted mb-1.5">Confirm new password</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors" />
        </div>
      )}
      {error   && <p className="text-xs text-error">{error}</p>}
      {message && <p className="text-xs text-success">{message}</p>}
      <button type="submit" disabled={saving} className="bg-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors">
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
