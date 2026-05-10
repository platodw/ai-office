"use client";
import { useState } from "react";

const STATUSES = ["onboarding", "active", "offboarding", "churned"] as const;

const STYLES: Record<string, string> = {
  active:      "bg-success/10 text-success border-success/20",
  onboarding:  "bg-primary-soft text-primary-dark border-primary/20",
  offboarding: "bg-warning/10 text-warning border-warning/20",
  churned:     "bg-surface text-muted border-border",
};

export default function ClientStatusSelect({ clientId, initial }: { clientId: string; initial: string }) {
  const [status, setStatus] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setStatus(next);
    setSaving(true);
    await fetch(`/api/admin/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setSaving(false);
  }

  return (
    <select
      value={status}
      onChange={onChange}
      disabled={saving}
      className={`text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer appearance-none text-center focus:outline-none disabled:opacity-60 transition-colors ${STYLES[status] ?? STYLES.churned}`}
    >
      {STATUSES.map(s => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}
