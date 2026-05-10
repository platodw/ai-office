"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

const PROVIDERS = [
  {
    value:   "anthropic",
    label:   "Anthropic",
    idLabel: "Workspace ID",
    idHelp:  "Per-client — each client needs their own workspace. Go to console.anthropic.com → Settings → Workspaces, click the workspace, and copy the ID from the URL (e.g. wrkspc_01...).",
    keyLabel: "Admin API key",
    keyHelp:  "Shared across clients — one Admin key covers all workspaces in your Anthropic org. Must be an Admin key (sk-ant-admin...), not a regular API key. Create one at console.anthropic.com → Settings → Admin API Keys.",
    keyPlaceholder: "sk-ant-admin...",
  },
  {
    value:   "vercel",
    label:   "Vercel",
    idLabel: "Team slug or ID",
    idHelp:  "Shared — your Vercel team slug appears in the dashboard URL (e.g. dan-platos-projects). If the client has their own Vercel account, use their team slug instead.",
    keyLabel: "API token",
    keyHelp:  "Shared across clients — one token covers all teams under your Vercel account. Create at vercel.com/account/tokens. If the client has their own Vercel account, use their token.",
    keyPlaceholder: "vercel_...",
  },
  {
    value:   "supabase",
    label:   "Supabase",
    idLabel: "Project ref",
    idHelp:  "Per-client — each Supabase project has a unique ref. Found in the Supabase dashboard → Project Settings → General (e.g. zzeidumlgcvp...).",
    keyLabel: "Personal Access Token (PAT)",
    keyHelp:  "Shared across clients — one PAT covers all projects under your Supabase account. Must be a PAT (sbp_...), not a project service_role key. Create at supabase.com/dashboard/account/tokens.",
    keyPlaceholder: "sbp_...",
  },
  {
    value:   "other",
    label:   "Other",
    idLabel: "Account ID",
    idHelp:  "The identifier used to pull billing data for this provider.",
    keyLabel: "API key",
    keyHelp:  "The API key or token used to authenticate with this provider.",
    keyPlaceholder: "API key…",
  },
];

export default function NewApiConfigPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const [provider, setProvider]         = useState("anthropic");
  const [displayName, setDisplayName]   = useState("");
  const [externalId, setExternalId]     = useState("");
  const [apiKey, setApiKey]             = useState("");
  const [showKey, setShowKey]           = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const providerMeta = PROVIDERS.find(p => p.value === provider)!;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/api-configs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          display_name: displayName,
          external_id:  externalId,
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
    <div className="max-w-xl">
      <div className="mb-8">
        <a href={`/admin/clients/${clientId}`} className="text-xs text-muted hover:text-text transition-colors">
          ← Back to client
        </a>
        <h1 className="text-2xl font-bold text-text mt-3 mb-1">Add API configuration</h1>
        <p className="text-sm text-muted">Connect an external API account to pull billing data.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        <Field label="Provider" required>
          <div className="grid grid-cols-4 gap-2">
            {PROVIDERS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => setProvider(p.value)}
                className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  provider === p.value
                    ? "border-primary bg-primary-soft text-primary-dark"
                    : "border-border bg-surface-2 text-muted hover:text-text hover:border-text/20"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Display name" required>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder={`e.g. ${providerMeta.label} Production`}
            required
            className={inputCls}
          />
        </Field>

        <Field label={providerMeta.idLabel} required hint={providerMeta.idHelp}>
          <input
            type="text"
            value={externalId}
            onChange={e => setExternalId(e.target.value)}
            placeholder="e.g. wrkspc_01… / dan-platos-projects / zzeiduml…"
            required
            className={inputCls}
          />
        </Field>

        <Field label={providerMeta.keyLabel} hint={`${providerMeta.keyHelp} Stored encrypted in Supabase Vault. Leave blank to add later.`}>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={providerMeta.keyPlaceholder}
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

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !displayName.trim() || !externalId.trim()}
            className="bg-text text-bg text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-text-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
          <a href={`/admin/clients/${clientId}`} className="text-sm text-muted hover:text-text transition-colors">
            Cancel
          </a>
        </div>

      </form>
    </div>
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
