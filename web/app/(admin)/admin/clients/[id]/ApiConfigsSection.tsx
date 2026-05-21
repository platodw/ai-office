"use client";
import { useState } from "react";

type ApiConfig = {
  id: string;
  provider: string;
  display_name: string;
  external_id: string;
  is_active: boolean;
};

export default function ApiConfigsSection({
  clientId,
  configs,
}: {
  clientId: string;
  configs: ApiConfig[];
}) {
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [copying, setCopying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function toggleReveal(configId: string) {
    if (revealed[configId]) {
      const next = { ...revealed };
      delete next[configId];
      setRevealed(next);
      return;
    }
    setLoading(configId);
    const res = await fetch(`/api/admin/clients/${clientId}/api-configs/${configId}/reveal`);
    setLoading(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrors({ ...errors, [configId]: data.error ?? "Failed to retrieve key" });
      return;
    }
    const { value } = await res.json();
    setRevealed({ ...revealed, [configId]: value });
    const next = { ...errors };
    delete next[configId];
    setErrors(next);
  }

  async function copyKey(configId: string) {
    let value = revealed[configId];
    if (!value) {
      const res = await fetch(`/api/admin/clients/${clientId}/api-configs/${configId}/reveal`);
      if (!res.ok) return;
      value = (await res.json()).value;
    }
    await navigator.clipboard.writeText(value);
    setCopying(configId);
    setTimeout(() => setCopying(null), 1500);
  }

  if (!configs.length) {
    return <p className="text-xs text-muted">No API configurations added.</p>;
  }

  return (
    <ul className="space-y-2">
      {configs.map((c) => (
        <li key={c.id}>
          <div className="flex items-center justify-between py-1.5">
            <div className="min-w-0">
              <div className="text-sm font-medium text-text">{c.display_name}</div>
              <div className="text-xs text-muted font-mono">{c.provider} / {c.external_id}</div>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-3">
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  c.is_active ? "bg-success/10 text-success" : "bg-surface text-muted"
                }`}
              >
                {c.is_active ? "active" : "inactive"}
              </span>
              <button
                onClick={() => toggleReveal(c.id)}
                disabled={loading === c.id}
                className="text-xs text-muted hover:text-text transition-colors disabled:opacity-50"
              >
                {loading === c.id ? "Loading…" : revealed[c.id] ? "Hide key" : "Reveal key"}
              </button>
              <button
                onClick={() => copyKey(c.id)}
                className="text-xs text-muted hover:text-text transition-colors"
              >
                {copying === c.id ? "Copied!" : "Copy key"}
              </button>
              <a
                href={`/admin/clients/${clientId}/api-configs/${c.id}/edit`}
                className="text-xs text-muted hover:text-text transition-colors"
              >
                Edit
              </a>
            </div>
          </div>
          {errors[c.id] && (
            <p className="text-xs text-error mt-1">{errors[c.id]}</p>
          )}
          {revealed[c.id] && (
            <div className="mt-1.5 px-3 py-2 bg-surface rounded-lg border border-border">
              <code className="text-xs font-mono text-text break-all">{revealed[c.id]}</code>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
