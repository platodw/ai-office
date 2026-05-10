"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";

const inputCls = "w-full bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary";

export default function NewServicePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const today = new Date().toISOString().slice(0, 10);

  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [type, setType]               = useState<"one_time" | "recurring_monthly">("one_time");
  const [amount, setAmount]           = useState("");
  const [billingStart, setBillingStart] = useState(today);
  const [billingEnd, setBillingEnd]   = useState("");
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
      const res = await fetch(`/api/admin/clients/${clientId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          type,
          amount_cents: amountCents,
          billing_start: billingStart,
          billing_end: billingEnd || undefined,
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
        <h1 className="text-2xl font-bold text-text mt-3 mb-1">Add service</h1>
        <p className="text-sm text-muted">Track a project, retainer, or one-time fee for this client.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        <Field label="Service type" required>
          <div className="grid grid-cols-2 gap-2">
            {(["one_time", "recurring_monthly"] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  type === t
                    ? "border-primary bg-primary-soft text-primary-dark"
                    : "border-border bg-surface-2 text-muted hover:text-text hover:border-text/20"
                }`}
              >
                {t === "one_time" ? "One-time" : "Monthly recurring"}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted mt-1.5">
            {type === "one_time"
              ? "A fixed fee for a specific project or deliverable. Appears on the next invoice once."
              : "A flat monthly fee billed each period (e.g. support retainer, subscription)."}
          </p>
        </Field>

        <Field label="Name" required>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Initial onboarding, Monthly support retainer"
            required
            className={inputCls}
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="Optional notes about what this covers"
            className={`${inputCls} resize-none`}
          />
        </Field>

        <Field
          label={type === "recurring_monthly" ? "Monthly amount" : "Amount"}
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
              placeholder="0.00"
              required
              className={`${inputCls} pl-7`}
            />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={type === "recurring_monthly" ? "Billing start" : "Date"} required>
            <input
              type="date"
              value={billingStart}
              onChange={e => setBillingStart(e.target.value)}
              required
              className={inputCls}
            />
          </Field>

          {type === "recurring_monthly" && (
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

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !name.trim() || !amount || !billingStart}
            className="bg-text text-bg text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-text-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Saving…" : "Save service"}
          </button>
          <a href={`/admin/clients/${clientId}`} className="text-sm text-muted hover:text-text transition-colors">
            Cancel
          </a>
        </div>

      </form>
    </div>
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
