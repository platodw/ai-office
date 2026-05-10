"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PreloadedService, PreloadedSnapshot } from "./page";

const inputCls = "w-full bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary";

interface LineItem {
  id: string; // local key only
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  category: "service" | "infrastructure" | "project" | "other";
  billing_snapshot_id?: string;
  client_service_id?: string;
}

function buildSuggestedItems(services: PreloadedService[], snapshots: PreloadedSnapshot[]): LineItem[] {
  const items: LineItem[] = [];

  for (const s of services) {
    // Recurring monthly always appears; one-time only if not yet invoiced.
    if (s.type === "one_time" && s.invoiced_at) continue;
    items.push({
      id: `svc-${s.id}`,
      description: s.name + (s.description ? ` — ${s.description}` : ""),
      quantity: 1,
      unit_price_cents: s.amount_cents,
      total_cents: s.amount_cents,
      category: s.type === "one_time" ? "project" : "service",
      client_service_id: s.id,
    });
  }

  for (const snap of snapshots) {
    if (snap.amount_cents === 0) continue;
    const configName = snap.client_api_configs?.display_name;
    const label = configName ? `${snap.provider} — ${configName}` : snap.provider;
    items.push({
      id: `snap-${snap.id}`,
      description: `${label} (${snap.period_start} to ${snap.period_end})`,
      quantity: 1,
      unit_price_cents: snap.amount_cents,
      total_cents: snap.amount_cents,
      category: "infrastructure",
      billing_snapshot_id: snap.id,
    });
  }

  return items;
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

function displayToCents(val: string): number {
  return Math.round(parseFloat(val) * 100) || 0;
}

export default function NewInvoiceForm({
  clients,
  preselectedClientId,
  preloadedServices,
  preloadedSnapshots,
  currentMonthStart,
  currentMonthEnd,
}: {
  clients: { id: string; name: string }[];
  preselectedClientId: string | null;
  preloadedServices: PreloadedService[];
  preloadedSnapshots: PreloadedSnapshot[];
  currentMonthStart: string;
  currentMonthEnd: string;
}) {
  const router = useRouter();

  const today     = new Date().toISOString().slice(0, 10);
  const net30     = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [clientId, setClientId]     = useState(preselectedClientId ?? "");
  const [issuedDate, setIssuedDate] = useState(today);
  const [dueDate, setDueDate]       = useState(net30);
  const [notes, setNotes]           = useState("");
  const [lineItems, setLineItems]   = useState<LineItem[]>(
    () => buildSuggestedItems(preloadedServices, preloadedSnapshots)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);

  const subtotal = lineItems.reduce((s, li) => s + li.total_cents, 0);

  // When client changes, fetch their services + snapshots and rebuild suggestions.
  const handleClientChange = useCallback(async (newClientId: string) => {
    setClientId(newClientId);
    if (!newClientId) { setLineItems([]); return; }

    setLoadingClient(true);
    try {
      const [svcRes, snapRes] = await Promise.all([
        fetch(`/api/admin/clients/${newClientId}/services`),
        fetch(`/api/admin/billing-data?client=${newClientId}&period_start=${currentMonthStart}&period_end=${currentMonthEnd}`),
      ]);
      const services: PreloadedService[]   = svcRes.ok  ? await svcRes.json()  : [];
      const snapshots: PreloadedSnapshot[] = snapRes.ok ? await snapRes.json() : [];
      setLineItems(buildSuggestedItems(
        services.filter(s => s.type === "recurring_monthly" || !s.invoiced_at),
        snapshots,
      ));
    } finally {
      setLoadingClient(false);
    }
  }, [currentMonthStart, currentMonthEnd]);

  function updateItem(id: string, patch: Partial<LineItem>) {
    setLineItems(prev => prev.map(li => {
      if (li.id !== id) return li;
      const updated = { ...li, ...patch };
      // Recalc total when qty or price changes
      if ("quantity" in patch || "unit_price_cents" in patch) {
        updated.total_cents = Math.round(updated.quantity * updated.unit_price_cents);
      }
      return updated;
    }));
  }

  function removeItem(id: string) {
    setLineItems(prev => prev.filter(li => li.id !== id));
  }

  function addBlankItem() {
    setLineItems(prev => [...prev, {
      id: `manual-${Date.now()}`,
      description: "",
      quantity: 1,
      unit_price_cents: 0,
      total_cents: 0,
      category: "other",
    }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!lineItems.length) {
      setError("Add at least one line item");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          issued_date: issuedDate,
          due_date: dueDate,
          notes: notes || undefined,
          line_items: lineItems.map((li, i) => ({
            description: li.description,
            quantity: li.quantity,
            unit_price_cents: li.unit_price_cents,
            total_cents: li.total_cents,
            category: li.category,
            billing_snapshot_id: li.billing_snapshot_id,
            client_service_id: li.client_service_id,
            sort_order: i,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create invoice");
      }

      router.push("/admin/billing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Header fields */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1">
          <Field label="Client" required>
            <select
              value={clientId}
              onChange={e => handleClientChange(e.target.value)}
              required
              className={inputCls}
            >
              <option value="">Select client…</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Issue date" required>
          <input type="date" value={issuedDate} onChange={e => setIssuedDate(e.target.value)} required className={inputCls} />
        </Field>
        <Field label="Due date" required>
          <input type="date" value={dueDate} min={issuedDate} onChange={e => setDueDate(e.target.value)} required className={inputCls} />
        </Field>
      </div>

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-text">Line items</h2>
          {loadingClient && <span className="text-xs text-muted">Loading suggestions…</span>}
        </div>

        <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_80px_110px_110px_60px_28px] gap-2 px-4 py-2 border-b border-border bg-surface">
            <span className="text-xs font-semibold text-muted">Description</span>
            <span className="text-xs font-semibold text-muted">Category</span>
            <span className="text-xs font-semibold text-muted text-right">Unit price</span>
            <span className="text-xs font-semibold text-muted text-right">Qty</span>
            <span className="text-xs font-semibold text-muted text-right">Total</span>
            <span />
          </div>

          {lineItems.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted">
              {clientId ? "No suggestions — add items manually below." : "Select a client to load suggested line items."}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {lineItems.map(li => (
                <div key={li.id} className="grid grid-cols-[1fr_80px_110px_110px_60px_28px] gap-2 px-4 py-2.5 items-center">
                  <input
                    type="text"
                    value={li.description}
                    onChange={e => updateItem(li.id, { description: e.target.value })}
                    placeholder="Description"
                    required
                    className="bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
                  />
                  <select
                    value={li.category}
                    onChange={e => updateItem(li.id, { category: e.target.value as LineItem["category"] })}
                    className="bg-transparent text-xs text-muted focus:outline-none"
                  >
                    <option value="service">service</option>
                    <option value="infrastructure">infra</option>
                    <option value="project">project</option>
                    <option value="other">other</option>
                  </select>
                  <div className="relative">
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-muted text-xs">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={centsToDisplay(li.unit_price_cents)}
                      onChange={e => updateItem(li.id, { unit_price_cents: displayToCents(e.target.value) })}
                      className="w-full bg-transparent text-sm text-text text-right pl-3 focus:outline-none"
                    />
                  </div>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={li.quantity}
                    onChange={e => updateItem(li.id, { quantity: parseFloat(e.target.value) || 1 })}
                    className="bg-transparent text-sm text-text text-right focus:outline-none"
                  />
                  <span className="text-sm font-medium text-text text-right">${centsToDisplay(li.total_cents)}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(li.id)}
                    className="text-muted hover:text-error transition-colors text-lg leading-none"
                    title="Remove"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <button
              type="button"
              onClick={addBlankItem}
              className="text-xs text-primary-dark hover:underline"
            >
              + Add line item
            </button>
            <div className="text-sm font-semibold text-text">
              Subtotal: ${centsToDisplay(subtotal)}
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <Field label="Notes">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Optional notes printed on the invoice"
          className={`${inputCls} resize-none`}
        />
      </Field>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting || !clientId || !lineItems.length}
          className="bg-text text-bg text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-text-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Creating…" : "Create invoice"}
        </button>
        <a href="/admin/billing" className="text-sm text-muted hover:text-text transition-colors">Cancel</a>
      </div>

    </form>
  );
}

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
