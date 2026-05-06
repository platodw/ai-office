"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { OS, Integration, GoogleAccount, QuestionnaireResponses } from "@/lib/types";
import { Check, Plus, X, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";

const USE_CASES = [
  { id: "email", label: "Email management", desc: "Summarize, draft, and triage email" },
  { id: "calendar", label: "Calendar & scheduling", desc: "Check schedule, find free time, create events" },
  { id: "research", label: "Research & writing", desc: "Draft documents, summarize articles, do research" },
  { id: "finance", label: "Personal finance", desc: "Track spending, budgets, and net worth" },
  { id: "developer", label: "Developer tools", desc: "GitHub, code reviews, Supabase, Vercel" },
  { id: "automation", label: "Automations & workflows", desc: "Daily digests, scheduled tasks, health checks" },
  { id: "assistant", label: "Personal assistant", desc: "Reminders, quick lookups, general help" },
];

const OS_OPTIONS: { id: OS; label: string; icon: string }[] = [
  { id: "mac", label: "macOS", icon: "🍎" },
  { id: "windows", label: "Windows", icon: "🪟" },
  { id: "linux", label: "Linux", icon: "🐧" },
];

const INTEGRATIONS: { id: Integration; label: string; desc: string; badge?: string }[] = [
  { id: "github", label: "GitHub", desc: "Browse repos, review PRs, search code, manage issues." },
  { id: "pkb", label: "Personal Knowledge Base", desc: "Give Claude persistent memory across sessions.", badge: "Recommended" },
  { id: "telegram", label: "Telegram", desc: "Text Claude from your phone. Get proactive alerts." },
  { id: "finance", label: "Finance (Monarch Money)", desc: "Ask Claude about spending, budgets, and net worth." },
  { id: "workflows", label: "Scheduled Workflows", desc: "Daily digests, health checks, action proposals." },
];

const TOTAL_STEPS = 5;

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [os, setOs] = useState<OS>("windows");
  const [useCases, setUseCases] = useState<Set<string>>(new Set());
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleCalendar, setGoogleCalendar] = useState(true);
  const [googleGmail, setGoogleGmail] = useState(true);
  const [googleDrive, setGoogleDrive] = useState(false);
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccount[]>([{ email: "", type: "personal" }]);
  const [integrations, setIntegrations] = useState<Set<Integration>>(new Set(["pkb"]));

  function toggleUseCase(id: string) {
    setUseCases(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleIntegration(id: Integration) {
    setIntegrations(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function addGoogleAccount() {
    setGoogleAccounts(prev => [...prev, { email: "", type: "personal" }]);
  }
  function removeGoogleAccount(idx: number) {
    setGoogleAccounts(prev => prev.filter((_, i) => i !== idx));
  }
  function updateGoogleAccount(idx: number, field: keyof GoogleAccount, value: string) {
    setGoogleAccounts(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const responses: QuestionnaireResponses = {
        name,
        os,
        use_cases: Array.from(useCases),
        google_enabled: googleEnabled,
        google_calendar: googleCalendar,
        google_gmail: googleGmail,
        google_drive: googleDrive,
        google_accounts: googleAccounts.filter(a => a.email.trim()),
        integrations: Array.from(integrations),
      };

      // Save profile name + os
      await supabase.from("profiles").update({ name, os }).eq("id", user.id);

      // Save questionnaire responses
      await supabase.from("questionnaire_responses").upsert({
        user_id: user.id,
        responses,
        submitted_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      // Trigger guide generation
      const res = await fetch("/api/generate-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses }),
      });
      if (!res.ok) throw new Error("Guide generation failed");

      router.push("/guide");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-3xl mb-2">✦</div>
          <h1 className="text-xl font-bold text-white">Set up your AI Office</h1>
          <p className="text-muted text-sm mt-1">Step {step} of {TOTAL_STEPS}</p>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-surface-2 rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Steps */}
        <div className="bg-surface border border-border rounded-xl p-6">

          {/* Step 1: Name + OS */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-white mb-1">Let&apos;s get to know you</h2>
                <p className="text-muted text-sm">This personalizes your setup guide.</p>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">Your name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Alex Smith"
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-text text-sm placeholder-subtle focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-2">Your operating system</label>
                <div className="grid grid-cols-3 gap-2">
                  {OS_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setOs(opt.id)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border text-sm font-medium transition-all ${
                        os === opt.id
                          ? "border-primary bg-primary/10 text-white"
                          : "border-border bg-surface-2 text-muted hover:border-border-2"
                      }`}
                    >
                      <span className="text-xl">{opt.icon}</span>
                      <span className="text-xs">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Use cases */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-white mb-1">What do you want Claude to help with?</h2>
                <p className="text-muted text-sm">Select everything that applies — your guide will include only what&apos;s relevant.</p>
              </div>
              <div className="space-y-2">
                {USE_CASES.map(uc => {
                  const checked = useCases.has(uc.id);
                  return (
                    <button
                      key={uc.id}
                      onClick={() => toggleUseCase(uc.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                        checked ? "border-primary bg-primary/10" : "border-border bg-surface-2 hover:border-border-2"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                        checked ? "bg-primary border-primary" : "border-border-2"
                      }`}>
                        {checked && <Check size={10} className="text-white" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-text">{uc.label}</div>
                        <div className="text-xs text-muted">{uc.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Google */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-white mb-1">Google integrations</h2>
                <p className="text-muted text-sm">Connect Gmail, Calendar, and Drive so Claude can work with your actual data.</p>
              </div>
              <button
                onClick={() => setGoogleEnabled(!googleEnabled)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg border text-left transition-all ${
                  googleEnabled ? "border-primary bg-primary/10" : "border-border bg-surface-2 hover:border-border-2"
                }`}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                  googleEnabled ? "bg-primary border-primary" : "border-border-2"
                }`}>
                  {googleEnabled && <Check size={10} className="text-white" />}
                </div>
                <span className="text-sm font-medium text-text">I want to connect Google</span>
              </button>

              {googleEnabled && (
                <div className="space-y-4 pl-1">
                  {/* Services */}
                  <div>
                    <label className="block text-xs text-muted mb-2">Which services?</label>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { id: "calendar", label: "Calendar", val: googleCalendar, set: setGoogleCalendar },
                        { id: "gmail", label: "Gmail", val: googleGmail, set: setGoogleGmail },
                        { id: "drive", label: "Drive", val: googleDrive, set: setGoogleDrive },
                      ].map(svc => (
                        <button
                          key={svc.id}
                          onClick={() => svc.set(!svc.val)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            svc.val ? "bg-primary/20 border-primary text-primary" : "bg-surface-2 border-border text-muted hover:border-border-2"
                          }`}
                        >
                          {svc.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Accounts */}
                  <div>
                    <label className="block text-xs text-muted mb-2">Your Google account(s)</label>
                    <div className="space-y-2">
                      {googleAccounts.map((acct, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            type="email"
                            value={acct.email}
                            onChange={e => updateGoogleAccount(idx, "email", e.target.value)}
                            placeholder="email@gmail.com"
                            className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-text text-sm placeholder-subtle focus:outline-none focus:border-primary transition-colors"
                          />
                          <select
                            value={acct.type}
                            onChange={e => updateGoogleAccount(idx, "type", e.target.value)}
                            className="bg-surface-2 border border-border rounded-lg px-2 py-2 text-text text-xs focus:outline-none"
                          >
                            <option value="personal">Personal</option>
                            <option value="work">Work</option>
                          </select>
                          {googleAccounts.length > 1 && (
                            <button onClick={() => removeGoogleAccount(idx)} className="text-subtle hover:text-error transition-colors">
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={addGoogleAccount}
                      className="mt-2 flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors"
                    >
                      <Plus size={12} /> Add another account
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Integrations */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-white mb-1">Additional integrations</h2>
                <p className="text-muted text-sm">Choose the tools you want Claude connected to. You can always add more later.</p>
              </div>
              <div className="space-y-2">
                {INTEGRATIONS.map(intg => {
                  const checked = integrations.has(intg.id);
                  return (
                    <button
                      key={intg.id}
                      onClick={() => toggleIntegration(intg.id)}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                        checked ? "border-primary bg-primary/10" : "border-border bg-surface-2 hover:border-border-2"
                      }`}
                    >
                      <div className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                        checked ? "bg-primary border-primary" : "border-border-2"
                      }`}>
                        {checked && <Check size={10} className="text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text">{intg.label}</span>
                          {intg.badge && (
                            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                              {intg.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted mt-0.5">{intg.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 5: Confirm */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-white mb-1">Ready to generate your guide</h2>
                <p className="text-muted text-sm">Here&apos;s what we&apos;ll include based on your answers:</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <span className="text-muted w-24 flex-shrink-0">Name</span>
                  <span className="text-text">{name || "(not set)"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted w-24 flex-shrink-0">OS</span>
                  <span className="text-text capitalize">{os}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted w-24 flex-shrink-0">Use cases</span>
                  <span className="text-text">{Array.from(useCases).join(", ") || "None selected"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted w-24 flex-shrink-0">Google</span>
                  <span className="text-text">
                    {googleEnabled
                      ? [googleCalendar && "Calendar", googleGmail && "Gmail", googleDrive && "Drive"].filter(Boolean).join(", ")
                      : "Not connecting"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted w-24 flex-shrink-0">Tools</span>
                  <span className="text-text">{Array.from(integrations).join(", ") || "None"}</span>
                </div>
              </div>
              {error && (
                <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2 text-red-400 text-xs">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 1}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} /> Back
          </button>

          {step < TOTAL_STEPS ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
            >
              Continue <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : <>Generate my guide <ChevronRight size={14} /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
