"use client";
import { useState } from "react";
import { Check, ChevronDown, ChevronRight, ExternalLink, SkipForward } from "lucide-react";
import type { SetupStep } from "@/lib/types";

export default function StepList({ steps }: { steps: SetupStep[] }) {
  return (
    <div className="space-y-2">
      {steps.map(step => <StepCard key={step.id} step={step} />)}
    </div>
  );
}

function StepCard({ step }: { step: SetupStep }) {
  const [open, setOpen] = useState(
    step.status === "pending" || step.status === "in_progress"
  );
  const [status, setStatus] = useState(step.status);
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    await fetch(`/api/steps/${step.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setStatus(newStatus as SetupStep["status"]);
    setLoading(false);
    if (newStatus === "complete" || newStatus === "skipped") setOpen(false);
  }

  const isDone = status === "complete" || status === "skipped";

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      isDone ? "border-border opacity-70" : "border-border bg-surface"
    }`}>
      {/* Step header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 transition-colors"
      >
        {/* Status icon */}
        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border transition-all ${
          status === "complete" ? "bg-success border-success" :
          status === "skipped" ? "bg-subtle border-subtle" :
          status === "in_progress" ? "border-primary bg-primary/20" :
          "border-border-2"
        }`}>
          {status === "complete" && <Check size={10} className="text-white" />}
          {status === "skipped" && <SkipForward size={8} className="text-white" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isDone ? "text-muted" : "text-text"}`}>
              {step.title}
            </span>
            {status === "in_progress" && (
              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                In progress
              </span>
            )}
          </div>
        </div>

        {open ? <ChevronDown size={14} className="text-subtle flex-shrink-0" /> : <ChevronRight size={14} className="text-subtle flex-shrink-0" />}
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border">
          {step.description && (
            <p className="text-sm text-muted mt-3 leading-relaxed">{step.description}</p>
          )}

          {step.why && (
            <div className="bg-surface-2 rounded-lg p-3">
              <div className="text-xs text-muted uppercase tracking-wide mb-1 font-semibold">Why this matters</div>
              <p className="text-xs text-muted leading-relaxed">{step.why}</p>
            </div>
          )}

          {step.click_steps && step.click_steps.length > 0 && (
            <div>
              <div className="text-xs text-muted uppercase tracking-wide mb-2 font-semibold">Steps</div>
              <ol className="space-y-1.5">
                {step.click_steps.map((cs, i) => (
                  <li key={i} className="flex gap-2.5 text-sm">
                    <span className="text-subtle flex-shrink-0 text-xs mt-0.5 w-4">{i + 1}.</span>
                    <span className="text-text leading-relaxed">{cs}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {step.code_blocks && step.code_blocks.length > 0 && (
            <div>
              {step.code_blocks.map((cb, i) => (
                <div key={i}>
                  {cb.label && <div className="text-xs text-muted mb-1">{cb.label}</div>}
                  <pre className="text-xs overflow-x-auto">{cb.content}</pre>
                </div>
              ))}
            </div>
          )}

          {step.notes && step.notes.length > 0 && (
            <div className="space-y-1">
              {step.notes.map((note, i) => (
                <div key={i} className="flex gap-2 text-xs text-muted">
                  <span className="text-subtle flex-shrink-0">ℹ</span>
                  <span>{note}</span>
                </div>
              ))}
            </div>
          )}

          {step.links && step.links.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {step.links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {link.label} <ExternalLink size={10} />
                </a>
              ))}
            </div>
          )}

          {/* Actions */}
          {!isDone && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => updateStatus("complete")}
                disabled={loading}
                className="flex items-center gap-1.5 bg-success/20 hover:bg-success/30 border border-success/30 text-success text-xs font-medium px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
              >
                <Check size={11} /> Mark complete
              </button>
              <button
                onClick={() => updateStatus("skipped")}
                disabled={loading}
                className="flex items-center gap-1.5 bg-surface-2 hover:bg-border border border-border text-muted text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
              >
                <SkipForward size={11} /> Skip
              </button>
            </div>
          )}
          {isDone && (
            <button
              onClick={() => updateStatus("pending")}
              disabled={loading}
              className="text-xs text-muted hover:text-text transition-colors"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
