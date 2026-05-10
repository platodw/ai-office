"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

const ID_LABELS: Record<string, string> = {
  anthropic: "Workspace ID",
  vercel:    "Team slug",
  supabase:  "Project ref",
  other:     "Account ID",
};

interface Config {
  id:           string;
  provider:     string;
  display_name: string;
  external_id:  string;
  is_active:    boolean;
}

export default function EditApiConfigForm({
  clientId,
  config,
}: {
  clientId: string;
  config: Config;
}) {
  const router = useRouter();

  const [displayName, setDisplayName] = useState(config.display_name);
  const [externalId, setExternalId]   = useState(config.external_id);
  const [isActive, setIsActive]       = useState(config.is_active);
  const [apiKey, setApiKey]           = useState("");
  const [showKey, setShowKey]         = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const idLabel = ID_LABELS[config.provider] ?? "Account ID";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/api-configs/${config.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          external_id:  externalId,
          is_active:    isActive,
          api_key:      apiKey || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }

      router.push(`/admin/clients/${clientId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      <div className="bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm text-muted">
        Provider: <span className="font-medium text-text capitalize">{config.provider}</span>
      </div>

      <Field label="Display name" required>
        <input
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          required
          className={inputCls}
        />
      </Field>

      <Field label={idLabel} required>
        <input
          type="text"
          value={externalId}
          onChange={e => setExternalId(e.target.value)}
          required
          className={inputCls}
        />
      </Field>

      <Field label="New API key" hint="Leave blank to keep the existing key. Enter a new value to replace it.">
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Enter new key to replace existing…"
            className={`${inputCls} pr-10 font-mono`}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowKey(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors"
          >
            {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </Field>

      <Field label="Status">
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setIsActive(v => !v)}
            className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${isActive ? "bg-success" : "bg-border"}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isActive ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
          <span className="text-sm text-text">{isActive ? "Active" : "Inactive"}</span>
        </label>
      </Field>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting || !displayName.trim() || !externalId.trim()}
          className="bg-text text-bg text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-text-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Saving…" : "Save changes"}
        </button>
        <a href={`/admin/clients/${clientId}`} className="text-sm text-muted hover:text-text transition-colors">
          Cancel
        </a>
      </div>

    </form>
  );
}

const inputCls = "w-full bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary";

function Field({ label, children, required, hint }: {
  label: string; children: React.ReactNode; required?: boolean; hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-text mb-1.5">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted mt-1.5">{hint}</p>}
    </div>
  );
}
