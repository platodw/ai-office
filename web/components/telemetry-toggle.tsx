"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function TelemetryToggle({
  initial,
  userId,
}: {
  initial: boolean;
  userId: string;
}) {
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const supabase = createClient();

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ allow_telemetry: next })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      setEnabled(!next);
      return;
    }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-text mb-1">
            Help improve the setup guide
          </h2>
          <p className="text-muted text-xs leading-relaxed">
            Share anonymous chat questions so we can spot places where the
            instructions are unclear and improve them. We strip emails, phone
            numbers, tokens, and file paths before anything leaves your
            browser. Page content is never sent — only the domain.
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          aria-pressed={enabled}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
            enabled ? "bg-primary" : "bg-border-2"
          } ${saving ? "opacity-50" : ""}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-bg shadow transition-transform mt-0.5 ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {savedFlash && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-success">
          <Check size={12} /> Saved
        </div>
      )}
    </div>
  );
}
