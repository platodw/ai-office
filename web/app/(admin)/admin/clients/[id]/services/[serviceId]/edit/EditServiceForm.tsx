"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputCls = "w-full bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary";

interface Service {
  id: string;
  name: string;
  description: string | null;
  type: string;
  amount_cents: number;
  billing_start: string;
  billing_end: string | null;
  status: string;
}

export default function EditServiceForm({ clientId, service }: { clientId: string; service: Service }) {
  const router = useRouter();

  const [name, setName]               = useState(service.name);
  const [description, setDescription] = useState(service.description ?? "");
  const [amount, setAmount]           = useState((service.amount_cents / 100).toFixed(2));
  const [billingStart, setBillingStart] = useState(service.billing_start);
  const [billingEnd, setBillingEnd]   = useState(service.billing_end ?? "");
  const [status, setStatus]           = useState(service.status);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents < 0) {
      setError("Enter a valid amount");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          amount_cents: amountCents,
          billing_start: billingStart,
          billing_end: billingEnd || null,
          status,
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
        Type: <span className="font-medium text-text">{service.type === "one_time" ? "One-time" : "Monthly recurring"}</span>
      </div>

      <Field label="Name" required>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className={inputCls}
        />
      </Field>

      <Field label="Description">
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          className={`${inputCls} resize-none`}
        />
      </Field>

      <Field
        label={service.type === "recurring_monthly" ? "Monthly amount" : "Amount"}
        required
      >
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
            className={`${inputCls} pl-7`}
          />
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={service.type === "recurring_monthly" ? "Billing start" : "Date"} required>
          <input
            type="date"
            value={billingStart}
            onChange={e => setBillingStart(e.target.value)}
            required
            className={inputCls}
          />
        </Field>

        {service.type === "recurring_monthly" && (
          <Field label="End date" hint="Leave blank if ongoing">
            <input
              type="date"
              value={billingEnd}
              onChange={e => setBillingEnd(e.target.value)}
              min={billingStart}
              className={inputCls}
            />
          </Field>
        )}
      </div>

      <Field label="Status">
        <div className="flex gap-2">
          {(["active", "completed", "cancelled"] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium capitalize transition-colors ${
                status === s
                  ? s === "active"
                    ? "border-success bg-success/10 text-success"
                    : s === "cancelled"
                    ? "border-error bg-error/10 text-error"
                    : "border-primary bg-primary-soft text-primary-dark"
                  : "border-border bg-surface-2 text-muted hover:text-text hover:border-text/20"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </Field>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting || !name.trim() || !amount || !billingStart}
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
