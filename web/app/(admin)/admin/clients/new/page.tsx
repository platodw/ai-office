"use client";

import { useState, useRef } from "react";
import { useRouter }        from "next/navigation";
import { Upload, X }        from "lucide-react";

export default function NewClientPage() {
  const router = useRouter();

  // Basic info
  const [name, setName]         = useState("");
  const [status, setStatus]     = useState("onboarding");
  const [website, setWebsite]   = useState("");
  const [industry, setIndustry] = useState("");
  const [notes, setNotes]       = useState("");

  // Branding
  const [brandColor, setBrandColor] = useState("#3B82F6");
  const [logoFile, setLogoFile]     = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Primary contact
  const [contactName, setContactName]   = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactRole, setContactRole]   = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function clearLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const form = new FormData();
      form.set("name",          name);
      form.set("status",        status);
      form.set("website",       website);
      form.set("industry",      industry);
      form.set("notes",         notes);
      form.set("brand_color",   brandColor);
      form.set("contact_name",  contactName);
      form.set("contact_email", contactEmail);
      form.set("contact_phone", contactPhone);
      form.set("contact_role",  contactRole);
      if (logoFile) form.set("logo", logoFile);

      const res = await fetch("/api/admin/clients", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create client");
      }
      const { clientId } = await res.json();
      router.push(`/admin/clients/${clientId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <a href="/admin/clients" className="text-xs text-muted hover:text-text transition-colors">
          ← Clients
        </a>
        <h1 className="text-2xl font-bold text-text mt-3 mb-1">Add client</h1>
        <p className="text-sm text-muted">Create a new client account.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* ── Basic info ── */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Basic info</legend>

          <Field label="Company name" required>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Acme Corp" required
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
                <option value="onboarding">Onboarding</option>
                <option value="active">Active</option>
                <option value="offboarding">Offboarding</option>
                <option value="churned">Churned</option>
              </select>
            </Field>
            <Field label="Industry">
              <input
                type="text" value={industry} onChange={e => setIndustry(e.target.value)}
                placeholder="e.g. Real estate, Legal"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Website">
            <input
              type="url" value={website} onChange={e => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className={inputCls}
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Internal notes about this client"
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </Field>
        </fieldset>

        {/* ── Branding ── */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Branding</legend>

          {/* Logo upload */}
          <Field label="Logo">
            {logoPreview ? (
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoPreview} alt="Logo preview" className="h-16 w-16 object-contain rounded-lg border border-border bg-surface" />
                <div>
                  <p className="text-sm text-text">{logoFile?.name}</p>
                  <button type="button" onClick={clearLogo} className="text-xs text-error hover:underline flex items-center gap-1 mt-1">
                    <X size={11} /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 border border-dashed border-border rounded-lg px-5 py-4 text-sm text-muted hover:border-primary hover:text-primary transition-colors w-full justify-center"
              >
                <Upload size={16} />
                Upload logo (PNG, SVG, JPG)
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={handleLogoChange}
              className="hidden"
            />
          </Field>

          {/* Brand color */}
          <Field label="Brand color">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandColor}
                onChange={e => setBrandColor(e.target.value)}
                className="h-10 w-14 rounded-lg border border-border cursor-pointer bg-surface p-1"
              />
              <input
                type="text"
                value={brandColor}
                onChange={e => setBrandColor(e.target.value)}
                placeholder="#3B82F6"
                className={`${inputCls} w-32 font-mono`}
              />
              <span className="text-xs text-muted">Used in the client portal header.</span>
            </div>
          </Field>
        </fieldset>

        {/* ── Primary contact ── */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Primary contact <span className="normal-case font-normal">(optional)</span></legend>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Name">
              <input
                type="text" value={contactName} onChange={e => setContactName(e.target.value)}
                placeholder="Jane Smith"
                className={inputCls}
              />
            </Field>
            <Field label="Role">
              <input
                type="text" value={contactRole} onChange={e => setContactRole(e.target.value)}
                placeholder="Power User, Billing Contact…"
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <input
                type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                placeholder="jane@example.com"
                className={inputCls}
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                placeholder="(555) 000-0000"
                className={inputCls}
              />
            </Field>
          </div>
        </fieldset>

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="bg-text text-bg text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-text-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Saving…" : "Save client"}
          </button>
          <a href="/admin/clients" className="text-sm text-muted hover:text-text transition-colors">
            Cancel
          </a>
        </div>

      </form>
    </div>
  );
}

const inputCls = "w-full bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary";

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-text mb-1.5">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
