"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { OS, EmailAccount, Briefing, QuestionnaireResponses } from "@/lib/types";
import { Check, Plus, X, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";

// ── Types ──────────────────────────────────────────────────────────────────
type StepId =
  | "about-you"
  | "quick-check"
  | "categories"
  | "productivity"
  | "docs"
  | "app-dev"
  | "finance"
  | "creative"
  | "goal"
  | "review";

const CATEGORY_STEP_ORDER: StepId[] = [
  "productivity", "docs", "app-dev", "finance", "creative",
];

function buildStepList(cats: Set<string>): StepId[] {
  return [
    "about-you",
    "quick-check",
    "categories",
    ...CATEGORY_STEP_ORDER.filter(c => cats.has(c)),
    "goal",
    "review",
  ];
}

const STEP_META: Record<StepId, { title: string; icon: string; desc: string }> = {
  "about-you":    { icon: "👤", title: "About You",                    desc: "A few basics so your guide is tailored to you." },
  "quick-check":  { icon: "✅", title: "Quick Check",                   desc: "These shape what's included in your guide." },
  "categories":   { icon: "🗂️", title: "Your Interests",               desc: "Select what you want Claude to help with." },
  "productivity": { icon: "📧", title: "Productivity",                  desc: "Email, calendar, notes, briefings, and messaging." },
  "docs":         { icon: "📄", title: "Document Creation & Editing",   desc: "Working with documents and organizing files." },
  "app-dev":      { icon: "💻", title: "App & Website Development",     desc: "Code repos, databases, and deployments." },
  "finance":      { icon: "💰", title: "Financial Management",          desc: "Spending, budgets, and financial tracking." },
  "creative":     { icon: "🎨", title: "Creative Tools",                desc: "Design and creative app connectors." },
  "goal":         { icon: "🎯", title: "Your Goal",                     desc: "Tell us what you most want Claude to do." },
  "review":       { icon: "✨", title: "Review & Generate",             desc: "Almost done — generate your personalized guide." },
};

// ── Constants ──────────────────────────────────────────────────────────────
const OS_OPTIONS: { id: OS; label: string; icon: string }[] = [
  { id: "mac",     label: "macOS",   icon: "🍎" },
  { id: "windows", label: "Windows", icon: "🪟" },
];


const CATEGORIES = [
  { id: "productivity", icon: "📧", label: "Productivity",                desc: "Email, calendar, notes, briefings, action items" },
  { id: "docs",         icon: "📄", label: "Document Creation & Editing", desc: "Draft, edit, and organize documents and files" },
  { id: "app-dev",      icon: "💻", label: "App & Website Development",   desc: "GitHub, databases, deployments" },
  { id: "finance",      icon: "💰", label: "Financial Management",        desc: "Spending, budgets, and financial tracking" },
  { id: "creative",     icon: "🎨", label: "Creative Tools",              desc: "Blender, Adobe CC, Autodesk, Ableton, and more" },
];

const BRIEFING_TOPICS = [
  { id: "email",        label: "Email summary" },
  { id: "calendar",     label: "Calendar" },
  { id: "action_items", label: "Action items" },
  { id: "news",         label: "News & headlines" },
  { id: "finance",      label: "Finance snapshot" },
];

const NOTE_TAKING_OPTIONS = [
  { id: "notion",  label: "Notion" },
  { id: "granola", label: "Granola" },
  { id: "otter",   label: "Otter" },
  { id: "other",   label: "Other" },
  { id: "none",    label: "None" },
];

const ACTION_DELIVERY_OPTIONS = [
  { id: "briefing",  label: "My daily briefing" },
  { id: "email",     label: "A separate email" },
  { id: "messaging", label: "Telegram / WhatsApp" },
];

const CREATIVE_TOOLS = ["Blender", "Adobe CC", "Autodesk Fusion", "Ableton", "SketchUp", "Affinity"].map(l => ({ id: l.toLowerCase().replace(/\s+/g, "-"), label: l }));
const FINANCE_TOOLS  = ["Monarch Money", "ProjectionLab", "QuickBooks"].map(l => ({ id: l.toLowerCase().replace(/\s+/g, "-"), label: l }));

const APP_USER_COUNT_OPTIONS = ["1–50", "50–200", "200–1,000", "1,000+"];

// ── Sub-components ─────────────────────────────────────────────────────────
function Question({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <label className="block text-sm font-medium text-text">{label}</label>
        {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function CheckRow({ checked, onClick, label, desc }: { checked: boolean; onClick: () => void; label: string; desc?: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
        checked ? "border-primary bg-primary/10" : "border-border bg-surface-2 hover:border-border-2"
      }`}
    >
      <div className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
        checked ? "bg-primary border-primary" : "border-border-2"
      }`}>
        {checked && <Check size={10} className="text-white" />}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-text">{label}</div>
        {desc && <div className="text-xs text-muted mt-0.5">{desc}</div>}
      </div>
    </button>
  );
}

function RadioRow({ checked, onClick, label, desc }: { checked: boolean; onClick: () => void; label: string; desc?: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
        checked ? "border-primary bg-primary/10" : "border-border bg-surface-2 hover:border-border-2"
      }`}
    >
      <div className={`w-4 h-4 mt-0.5 rounded-full flex items-center justify-center flex-shrink-0 border transition-all ${
        checked ? "bg-primary border-primary" : "border-border-2"
      }`}>
        {checked && <div className="w-2 h-2 bg-white rounded-full" />}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-text">{label}</div>
        {desc && <div className="text-xs text-muted mt-0.5">{desc}</div>}
      </div>
    </button>
  );
}

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs">
      {children}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 1: About You
  const [name, setName] = useState("");
  const [os, setOs] = useState<OS>("windows");
  const [useCase, setUseCase] = useState<"work" | "personal" | "both" | null>(null);

  // Step 2: Quick Check
  const [hasClaudeAccount, setHasClaudeAccount] = useState<boolean | null>(null);
  const [hasClaudeDesktop, setHasClaudeDesktop] = useState<boolean | null>(null);
  const [hasAdminAccess, setHasAdminAccess] = useState<boolean | null>(null);

  // Step 3: Categories
  const [categories, setCategories] = useState<Set<string>>(new Set());

  // Productivity — email
  const [emailPlatforms, setEmailPlatforms] = useState<Set<"google" | "microsoft">>(new Set());
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [googleCalendar, setGoogleCalendar] = useState(false);
  const [microsoftCalendar, setMicrosoftCalendar] = useState(false);
  const [googleDrive, setGoogleDrive] = useState(false);
  const [microsoftSharepoint, setMicrosoftSharepoint] = useState(false);
  // Productivity — note-taking
  const [noteTakingTool, setNoteTakingTool] = useState<string | null>(null);
  const [noteTakingOther, setNoteTakingOther] = useState("");
  const [wantsNoteTakingSetup, setWantsNoteTakingSetup] = useState(false);
  // Productivity — briefings
  const [wantsBriefings, setWantsBriefings] = useState(false);
  const [briefings, setBriefings] = useState<Briefing[]>([
    { title: "Morning Briefing", preferred_time: "8:00 AM", topics: ["email", "calendar"] },
  ]);
  // Productivity — action items
  const [wantsActionItems, setWantsActionItems] = useState(false);
  const [actionItemDelivery, setActionItemDelivery] = useState<Set<string>>(new Set());
  // Productivity — messaging
  const [messagingApp, setMessagingApp] = useState<"telegram" | "whatsapp" | null>(null);

  // Document Creation
  const [wantsDocEditing, setWantsDocEditing] = useState(false);
  const [wantsFileOrganization, setWantsFileOrganization] = useState(false);

  // App Dev
  const [wantsAppDev, setWantsAppDev] = useState(false);
  const [github, setGithub] = useState(false);
  const [supabaseDb, setSupabaseDb] = useState(false);
  const [vercel, setVercel] = useState(false);
  const [appsPublic, setAppsPublic] = useState<boolean | null>(null);
  const [appsNeedData, setAppsNeedData] = useState<boolean | null>(null);
  const [appUserCount, setAppUserCount] = useState<string | null>(null);

  // Creative / Finance
  const [creativeTools, setCreativeTools] = useState<Set<string>>(new Set());
  const [financeTools, setFinanceTools] = useState<Set<string>>(new Set());
  const [financeOther, setFinanceOther] = useState("");

  // Goal
  const [goal, setGoal] = useState("");

  // ── Derived values ────────────────────────────────────────────────────
  const pkbEnabled = wantsBriefings || wantsActionItems;
  const googleGmail = emailPlatforms.has("google");
  const microsoftOutlook = emailPlatforms.has("microsoft");

  const stepList = buildStepList(categories);
  const safeIndex = Math.min(stepIndex, stepList.length - 1);
  const currentStep = stepList[safeIndex];
  const totalSteps = stepList.length;
  const meta = STEP_META[currentStep];

  // ── Navigation ────────────────────────────────────────────────────────
  function goNext() {
    if (currentStep === "categories") {
      setStepIndex(3);
    } else {
      setStepIndex(i => Math.min(i + 1, stepList.length - 1));
    }
  }
  function goBack() {
    setStepIndex(i => Math.max(i - 1, 0));
  }

  function canAdvance(): boolean {
    if (currentStep === "about-you") return name.trim().length > 0 && useCase !== null;
    if (currentStep === "quick-check") return hasClaudeAccount !== null && hasClaudeDesktop !== null && hasAdminAccess !== null;
    return true;
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function toggleCategory(id: string) {
    setCategories(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleEmailPlatform(p: "google" | "microsoft") {
    setEmailPlatforms(prev => {
      const n = new Set(prev);
      if (n.has(p)) {
        n.delete(p);
        setEmailAccounts(prev => prev.filter(a => a.provider !== p));
      } else {
        n.add(p);
        setEmailAccounts(prev => [...prev, { email: "", provider: p, account_type: "personal", has_admin_control: false }]);
      }
      return n;
    });
  }
  function addEmailAccount(provider: "google" | "microsoft") {
    setEmailAccounts(prev => [...prev, { email: "", provider, account_type: "personal", has_admin_control: false }]);
  }
  function removeEmailAccount(idx: number) {
    setEmailAccounts(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      if (!updated.some(a => a.provider === "google")) setEmailPlatforms(p => { const n = new Set(p); n.delete("google"); return n; });
      if (!updated.some(a => a.provider === "microsoft")) setEmailPlatforms(p => { const n = new Set(p); n.delete("microsoft"); return n; });
      return updated;
    });
  }
  function updateEmailAccount(idx: number, field: keyof EmailAccount, value: string | boolean) {
    setEmailAccounts(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  }
  function toggleBriefingTopic(idx: number, topic: string) {
    setBriefings(prev => prev.map((b, i) => {
      if (i !== idx) return b;
      const topics = b.topics.includes(topic) ? b.topics.filter(t => t !== topic) : [...b.topics, topic];
      return { ...b, topics };
    }));
  }
  function updateBriefing(idx: number, field: keyof Omit<Briefing, "topics">, value: string) {
    setBriefings(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
  }
  function removeBriefing(idx: number) {
    setBriefings(prev => prev.filter((_, i) => i !== idx));
  }
  function addBriefing() {
    setBriefings(prev => [...prev, { title: "", preferred_time: "9:00 AM", topics: [] }]);
  }
  function toggleSet(s: Set<string>, id: string, setter: (fn: (prev: Set<string>) => Set<string>) => void) {
    setter(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleActionDelivery(id: string) {
    setActionItemDelivery(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  // ── Submit ────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const responses: QuestionnaireResponses = {
        name, os,
use_case: useCase ?? "personal",
        has_claude_account: hasClaudeAccount ?? false,
        has_claude_desktop: hasClaudeDesktop ?? false,
        has_admin_access: hasAdminAccess ?? true,
        categories: Array.from(categories),
        email_accounts: emailAccounts.filter(a => a.email.trim()),
        google_gmail: googleGmail,
        google_calendar: googleCalendar,
        google_drive: googleDrive,
        microsoft_outlook: microsoftOutlook,
        microsoft_calendar: microsoftCalendar,
        microsoft_sharepoint: microsoftSharepoint,
        note_taking_tool: noteTakingTool === "none" ? null : noteTakingTool,
        note_taking_other: noteTakingOther,
        wants_note_taking_setup: wantsNoteTakingSetup,
        wants_briefings: wantsBriefings,
        briefings: wantsBriefings ? briefings.filter(b => b.title.trim()) : [],
        wants_action_items: wantsActionItems,
        action_item_delivery: Array.from(actionItemDelivery),
        messaging_app: messagingApp,
        pkb: pkbEnabled,
        wants_doc_editing: wantsDocEditing,
        wants_file_organization: wantsFileOrganization,
        wants_app_dev: wantsAppDev,
        github, supabase_db: supabaseDb, vercel,
        apps_publicly_accessible: appsPublic,
        apps_need_data_storage: appsNeedData,
        app_user_count: appUserCount,
        creative_tools: Array.from(creativeTools),
        finance_tools: Array.from(financeTools),
        finance_other: financeOther,
        goal,
      };

      await supabase.from("profiles").update({ name, os }).eq("id", user.id);
      await supabase.from("questionnaire_responses").upsert({
        user_id: user.id, responses, submitted_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

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

  // ── Render ────────────────────────────────────────────────────────────
  const progress = ((safeIndex + 1) / totalSteps) * 100;
  const googleAccounts = emailAccounts.filter(a => a.provider === "google");
  const microsoftAccounts = emailAccounts.filter(a => a.provider === "microsoft");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3"><LogoMark size={36} /></div>
          <h1 className="text-xl font-semibold text-text tracking-tight">{meta.title}</h1>
          <p className="text-muted text-sm mt-1">Step {safeIndex + 1} of {totalSteps}</p>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-surface-2 rounded-full mb-8 overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-xl p-6">

          {/* ── About You ── */}
          {currentStep === "about-you" && (
            <div className="space-y-6">
              <p className="text-muted text-sm">{meta.desc}</p>
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
                <label className="block text-xs text-muted mb-2">Operating system</label>
                <div className="grid grid-cols-2 gap-2">
                  {OS_OPTIONS.map(opt => (
                    <button key={opt.id} onClick={() => setOs(opt.id)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border text-sm font-medium transition-all ${
                        os === opt.id ? "border-primary bg-primary-soft text-text" : "border-border bg-surface-2 text-muted hover:border-border-2"
                      }`}
                    >
                      <span className="text-xl">{opt.icon}</span>
                      <span className="text-xs">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted mb-2">Setting up Claude for</label>
                <div className="space-y-2">
                  {[
                    { id: "work" as const,     label: "Work",              desc: "Client work, internal tools, business tasks" },
                    { id: "personal" as const, label: "Personal",          desc: "Personal productivity, home life, side projects" },
                    { id: "both" as const,     label: "Both",              desc: "Work and personal use" },
                  ].map(opt => (
                    <RadioRow key={opt.id} checked={useCase === opt.id} onClick={() => setUseCase(opt.id)} label={opt.label} desc={opt.desc} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Quick Check ── */}
          {currentStep === "quick-check" && (
            <div className="space-y-6">
              <p className="text-muted text-sm">{meta.desc}</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-text mb-0.5">Do you have a Claude account?</label>
                  <p className="text-xs text-muted mb-2">Any paid plan — Pro, Max, or Team. Free accounts can&apos;t use Claude Desktop or Claude Code.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[{ val: true, label: "Yes" }, { val: false, label: "Not yet" }].map(opt => (
                    <button key={String(opt.val)} onClick={() => setHasClaudeAccount(opt.val)}
                      className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                        hasClaudeAccount === opt.val ? "border-primary bg-primary-soft text-text" : "border-border bg-surface-2 text-muted hover:border-border-2"
                      }`}
                    >{opt.label}</button>
                  ))}
                </div>
                {hasClaudeAccount === false && (
                  <p className="text-xs text-warning bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                    Your guide will start with signing up. Claude Pro ($20/mo) is enough to get started.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-text mb-0.5">Have you downloaded Claude Desktop?</label>
                  <p className="text-xs text-muted mb-2">The free desktop app from claude.ai/download. Required for all MCP connectors.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[{ val: true, label: "Yes, installed" }, { val: false, label: "Not yet" }].map(opt => (
                    <button key={String(opt.val)} onClick={() => setHasClaudeDesktop(opt.val)}
                      className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                        hasClaudeDesktop === opt.val ? "border-primary bg-primary-soft text-text" : "border-border bg-surface-2 text-muted hover:border-border-2"
                      }`}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-text mb-0.5">Can you install software on this computer?</label>
                  <p className="text-xs text-muted mb-2">Some steps require installing apps or running commands with admin rights.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[{ val: true, label: "Yes, full access" }, { val: false, label: "Limited / IT managed" }].map(opt => (
                    <button key={String(opt.val)} onClick={() => setHasAdminAccess(opt.val)}
                      className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                        hasAdminAccess === opt.val ? "border-primary bg-primary-soft text-text" : "border-border bg-surface-2 text-muted hover:border-border-2"
                      }`}
                    >{opt.label}</button>
                  ))}
                </div>
                {hasAdminAccess === false && (
                  <p className="text-xs text-text-2 bg-surface border border-border rounded-lg px-3 py-2">
                    Steps that require admin access will be flagged so you know when to involve IT.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Categories ── */}
          {currentStep === "categories" && (
            <div className="space-y-4">
              <p className="text-muted text-sm">{meta.desc} You&apos;ll answer a few questions about each area you select.</p>
              <div className="space-y-2">
                {CATEGORIES.map(cat => {
                  const checked = categories.has(cat.id);
                  return (
                    <button key={cat.id} onClick={() => toggleCategory(cat.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                        checked ? "border-primary bg-primary/10" : "border-border bg-surface-2 hover:border-border-2"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                        checked ? "bg-primary border-primary" : "border-border-2"
                      }`}>
                        {checked && <Check size={10} className="text-white" />}
                      </div>
                      <span className="text-lg leading-none">{cat.icon}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-text">{cat.label}</div>
                        <div className="text-xs text-muted">{cat.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {categories.size === 0 && (
                <p className="text-xs text-subtle text-center pt-1">Select at least one area, or continue for a general Claude setup guide.</p>
              )}
            </div>
          )}

          {/* ── Productivity ── */}
          {currentStep === "productivity" && (
            <div className="space-y-6">
              <p className="text-muted text-sm">{meta.desc}</p>

              {/* Email platform */}
              <Question label="Which email platform(s) do you use?">
                <div className="flex gap-2">
                  <button onClick={() => toggleEmailPlatform("google")}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      emailPlatforms.has("google") ? "border-primary bg-primary-soft text-text" : "border-border bg-surface-2 text-muted hover:border-border-2"
                    }`}>Gmail</button>
                  <button onClick={() => toggleEmailPlatform("microsoft")}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      emailPlatforms.has("microsoft") ? "border-primary bg-primary-soft text-text" : "border-border bg-surface-2 text-muted hover:border-border-2"
                    }`}>Outlook / M365</button>
                </div>
              </Question>

              {/* Email accounts */}
              {emailAccounts.length > 0 && (
                <Question label="Your email accounts" hint="For work accounts, we'll ask about admin access separately.">
                  <div className="space-y-3">
                    {emailAccounts.map((acct, idx) => (
                      <div key={idx} className="bg-surface-2 border border-border rounded-lg p-3 space-y-2">
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-muted w-14 flex-shrink-0">{acct.provider === "google" ? "Gmail" : "Outlook"}</span>
                          <input
                            type="email"
                            value={acct.email}
                            onChange={e => updateEmailAccount(idx, "email", e.target.value)}
                            placeholder={acct.provider === "google" ? "you@gmail.com" : "you@company.com"}
                            className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-text text-sm placeholder-subtle focus:outline-none focus:border-primary transition-colors"
                          />
                          <button onClick={() => removeEmailAccount(idx)} className="text-subtle hover:text-error transition-colors flex-shrink-0">
                            <X size={14} />
                          </button>
                        </div>
                        <div className="flex gap-2">
                          {(["personal", "work"] as const).map(t => (
                            <button key={t} onClick={() => updateEmailAccount(idx, "account_type", t)}
                              className={`flex-1 py-1.5 rounded-md border text-xs font-medium transition-all ${
                                acct.account_type === t ? "border-primary bg-primary-soft text-text" : "border-border bg-surface text-muted hover:border-border-2"
                              }`}
                            >{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                          ))}
                        </div>
                        {acct.account_type === "work" && (
                          <CheckRow
                            checked={acct.has_admin_control}
                            onClick={() => updateEmailAccount(idx, "has_admin_control", !acct.has_admin_control)}
                            label="I have admin control over this account"
                            desc="Can create OAuth apps, configure settings, and install integrations"
                          />
                        )}
                      </div>
                    ))}
                    {emailPlatforms.has("google") && (
                      <button onClick={() => addEmailAccount("google")} className="flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors">
                        <Plus size={12} /> Add Gmail account
                      </button>
                    )}
                    {emailPlatforms.has("microsoft") && (
                      <button onClick={() => addEmailAccount("microsoft")} className="flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors">
                        <Plus size={12} /> Add Outlook account
                      </button>
                    )}
                  </div>
                </Question>
              )}

              {/* Calendar */}
              {emailPlatforms.size > 0 && (
                <Question label="Calendar">
                  <div className="space-y-2">
                    {emailPlatforms.has("google") && (
                      <CheckRow checked={googleCalendar} onClick={() => setGoogleCalendar(!googleCalendar)} label="Google Calendar" />
                    )}
                    {emailPlatforms.has("microsoft") && (
                      <CheckRow checked={microsoftCalendar} onClick={() => setMicrosoftCalendar(!microsoftCalendar)} label="Microsoft Calendar" />
                    )}
                  </div>
                </Question>
              )}

              {/* File storage */}
              {emailPlatforms.size > 0 && (
                <Question label="File storage" hint="Let Claude search and read your documents.">
                  <div className="space-y-2">
                    {emailPlatforms.has("google") && (
                      <CheckRow checked={googleDrive} onClick={() => setGoogleDrive(!googleDrive)} label="Google Drive" />
                    )}
                    {emailPlatforms.has("microsoft") && (
                      <CheckRow checked={microsoftSharepoint} onClick={() => setMicrosoftSharepoint(!microsoftSharepoint)} label="SharePoint / OneDrive" />
                    )}
                  </div>
                </Question>
              )}

              {/* Note-taking */}
              <Question label="Note-taking tool" hint="Claude can connect to your notes and meeting transcripts.">
                <div className="space-y-2">
                  {NOTE_TAKING_OPTIONS.map(opt => (
                    <RadioRow
                      key={opt.id}
                      checked={noteTakingTool === opt.id}
                      onClick={() => {
                        setNoteTakingTool(opt.id);
                        if (opt.id !== "none") setWantsNoteTakingSetup(false);
                      }}
                      label={opt.label}
                    />
                  ))}
                </div>
                {noteTakingTool === "other" && (
                  <input
                    type="text"
                    value={noteTakingOther}
                    onChange={e => setNoteTakingOther(e.target.value)}
                    placeholder="Which tool?"
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-text text-sm placeholder-subtle focus:outline-none focus:border-primary transition-colors mt-2"
                  />
                )}
                {noteTakingTool === "none" && (
                  <div className="mt-2 p-3 bg-surface-2 border border-border rounded-lg space-y-2">
                    <p className="text-xs text-muted">Granola is a free meeting notes app that works well with Claude. Want setup instructions?</p>
                    <div className="flex gap-2">
                      {[{ val: true, label: "Yes, show me Granola" }, { val: false, label: "No thanks" }].map(opt => (
                        <button key={String(opt.val)} onClick={() => setWantsNoteTakingSetup(opt.val)}
                          className={`flex-1 py-1.5 rounded-md border text-xs font-medium transition-all ${
                            wantsNoteTakingSetup === opt.val ? "border-primary bg-primary-soft text-text" : "border-border bg-surface text-muted hover:border-border-2"
                          }`}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </div>
                )}
              </Question>

              {/* Daily Briefings */}
              <Question
                label="Daily briefings"
                hint="Claude delivers a scheduled digest — by email, Telegram, or WhatsApp."
              >
                <CheckRow
                  checked={wantsBriefings}
                  onClick={() => setWantsBriefings(!wantsBriefings)}
                  label="Send me a daily briefing"
                />
                {wantsBriefings && (
                  <div className="space-y-3 pt-1">
                    {briefings.map((b, idx) => (
                      <div key={idx} className="bg-surface-2 border border-border rounded-lg p-3 space-y-3">
                        <div className="flex gap-2 items-start">
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              value={b.title}
                              onChange={e => updateBriefing(idx, "title", e.target.value)}
                              placeholder="Briefing title (e.g. Morning Briefing)"
                              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text text-sm placeholder-subtle focus:outline-none focus:border-primary transition-colors"
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted flex-shrink-0">Deliver at</span>
                              <input
                                type="text"
                                value={b.preferred_time}
                                onChange={e => updateBriefing(idx, "preferred_time", e.target.value)}
                                placeholder="8:00 AM"
                                className="w-28 bg-surface border border-border rounded-lg px-3 py-1.5 text-text text-sm placeholder-subtle focus:outline-none focus:border-primary transition-colors"
                              />
                            </div>
                          </div>
                          {briefings.length > 1 && (
                            <button onClick={() => removeBriefing(idx)} className="text-subtle hover:text-error transition-colors mt-0.5"><X size={14} /></button>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs text-muted mb-1.5">What should this briefing cover?</label>
                          <div className="flex flex-wrap gap-1.5">
                            {BRIEFING_TOPICS.map(t => (
                              <button
                                key={t.id}
                                onClick={() => toggleBriefingTopic(idx, t.id)}
                                className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                                  b.topics.includes(t.id)
                                    ? "bg-primary/20 border-primary text-primary"
                                    : "bg-surface border-border text-muted hover:border-border-2"
                                }`}
                              >{t.label}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                    <button onClick={addBriefing} className="flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors">
                      <Plus size={12} /> Add another briefing
                    </button>
                  </div>
                )}
              </Question>

              {/* Action Items */}
              <Question
                label="Action items"
                hint="Claude monitors your inbox and meetings and proposes tasks for your approval."
              >
                <CheckRow
                  checked={wantsActionItems}
                  onClick={() => setWantsActionItems(!wantsActionItems)}
                  label="Propose action items from my emails and meetings"
                />
                {wantsActionItems && (
                  <div className="space-y-2 pt-1">
                    <label className="block text-xs text-muted">Where should Claude surface these?</label>
                    {ACTION_DELIVERY_OPTIONS.map(opt => (
                      <CheckRow
                        key={opt.id}
                        checked={actionItemDelivery.has(opt.id)}
                        onClick={() => toggleActionDelivery(opt.id)}
                        label={opt.label}
                      />
                    ))}
                  </div>
                )}
              </Question>

              {/* Messaging */}
              <Question label="Phone messaging" hint="Text Claude from your phone. Messages go directly to your local Claude instance.">
                <div className="space-y-2">
                  {[
                    { id: "telegram" as const,  label: "Telegram", desc: "Free messaging app" },
                    { id: "whatsapp" as const,   label: "WhatsApp", desc: "Works with your existing WhatsApp number" },
                  ].map(opt => (
                    <RadioRow
                      key={opt.id}
                      checked={messagingApp === opt.id}
                      onClick={() => setMessagingApp(messagingApp === opt.id ? null : opt.id)}
                      label={opt.label}
                      desc={opt.desc}
                    />
                  ))}
                  <button
                    onClick={() => setMessagingApp(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                      messagingApp === null ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface-2 text-muted hover:border-border-2"
                    }`}
                  >Skip — no phone access needed</button>
                </div>
              </Question>
            </div>
          )}

          {/* ── Document Creation & Editing ── */}
          {currentStep === "docs" && (
            <div className="space-y-5">
              <p className="text-muted text-sm">{meta.desc}</p>
              <Question label="What would you like Claude to help with?">
                <div className="space-y-2">
                  <CheckRow
                    checked={wantsDocEditing}
                    onClick={() => setWantsDocEditing(!wantsDocEditing)}
                    label="Edit and draft documents"
                    desc="Word, Google Docs, or other document editing"
                  />
                  <CheckRow
                    checked={wantsFileOrganization}
                    onClick={() => setWantsFileOrganization(!wantsFileOrganization)}
                    label="Organize and find files"
                    desc="Search across your files and keep folders organized"
                  />
                </div>
              </Question>
            </div>
          )}

          {/* ── App & Website Development ── */}
          {currentStep === "app-dev" && (
            <div className="space-y-5">
              <p className="text-muted text-sm">{meta.desc}</p>
              <Question label="Are you building apps or websites?">
                <div className="flex gap-2">
                  {[{ val: true, label: "Yes" }, { val: false, label: "No" }].map(opt => (
                    <button key={String(opt.val)} onClick={() => setWantsAppDev(opt.val)}
                      className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                        wantsAppDev === opt.val ? "border-primary bg-primary-soft text-text" : "border-border bg-surface-2 text-muted hover:border-border-2"
                      }`}
                    >{opt.label}</button>
                  ))}
                </div>
              </Question>

              <Question label="Which tools do you use?">
                <div className="space-y-2">
                  <CheckRow checked={github}      onClick={() => setGithub(!github)}           label="GitHub"    desc="Browse repos, review PRs, search code, manage issues" />
                  <CheckRow checked={supabaseDb}  onClick={() => setSupabaseDb(!supabaseDb)}   label="Supabase"  desc="Query databases, run migrations, manage projects" />
                  <CheckRow checked={vercel}      onClick={() => setVercel(!vercel)}           label="Vercel"    desc="Check deployment status, view build logs, monitor projects" />
                </div>
              </Question>

              {wantsAppDev && (
                <>
                  <Question label="Will your apps be publicly accessible?">
                    <div className="flex gap-2">
                      {[{ val: true, label: "Yes" }, { val: false, label: "No / internal only" }].map(opt => (
                        <button key={String(opt.val)} onClick={() => setAppsPublic(opt.val)}
                          className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                            appsPublic === opt.val ? "border-primary bg-primary-soft text-text" : "border-border bg-surface-2 text-muted hover:border-border-2"
                          }`}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </Question>

                  <Question label="Do your apps need data storage or databases?">
                    <div className="flex gap-2">
                      {[{ val: true, label: "Yes" }, { val: false, label: "No" }].map(opt => (
                        <button key={String(opt.val)} onClick={() => setAppsNeedData(opt.val)}
                          className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                            appsNeedData === opt.val ? "border-primary bg-primary-soft text-text" : "border-border bg-surface-2 text-muted hover:border-border-2"
                          }`}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </Question>

                  <Question label="Expected number of users">
                    <div className="grid grid-cols-2 gap-2">
                      {APP_USER_COUNT_OPTIONS.map(opt => (
                        <button key={opt} onClick={() => setAppUserCount(opt)}
                          className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${
                            appUserCount === opt ? "border-primary bg-primary-soft text-text" : "border-border bg-surface-2 text-muted hover:border-border-2"
                          }`}
                        >{opt}</button>
                      ))}
                    </div>
                  </Question>
                </>
              )}
            </div>
          )}

          {/* ── Creative Tools ── */}
          {currentStep === "creative" && (
            <div className="space-y-5">
              <p className="text-muted text-sm">{meta.desc}</p>
              <InfoBanner>
                <span className="text-primary">✓</span>
                <span className="text-muted">These connect through Claude&apos;s built-in Connectors — no local installation required.</span>
              </InfoBanner>
              <Question label="Which apps do you use?">
                <div className="space-y-2">
                  {CREATIVE_TOOLS.map(t => (
                    <CheckRow key={t.id} checked={creativeTools.has(t.id)} onClick={() => toggleSet(creativeTools, t.id, setCreativeTools)} label={t.label} />
                  ))}
                </div>
              </Question>
            </div>
          )}

          {/* ── Financial Management ── */}
          {currentStep === "finance" && (
            <div className="space-y-5">
              <p className="text-muted text-sm">{meta.desc}</p>
              <Question label="Which apps do you use?">
                <div className="space-y-2">
                  {FINANCE_TOOLS.map(t => (
                    <CheckRow key={t.id} checked={financeTools.has(t.id)} onClick={() => toggleSet(financeTools, t.id, setFinanceTools)} label={t.label} />
                  ))}
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-surface-2">
                    <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border border-border-2 opacity-50" />
                    <span className="text-sm text-muted flex-shrink-0">Other:</span>
                    <input
                      type="text"
                      value={financeOther}
                      onChange={e => setFinanceOther(e.target.value)}
                      placeholder="e.g. Personal Capital"
                      className="flex-1 bg-transparent text-text text-sm placeholder-subtle focus:outline-none min-w-0"
                    />
                  </div>
                </div>
              </Question>
            </div>
          )}

          {/* ── Goal ── */}
          {currentStep === "goal" && (
            <div className="space-y-5">
              <p className="text-muted text-sm">{meta.desc}</p>
              <Question label="What's the one thing you most want Claude to do for you?" hint="Optional, but helps Claude write a guide that's genuinely useful for your situation.">
                <textarea
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  placeholder="e.g. I want Claude to triage my email every morning and send me a summary to my phone."
                  rows={5}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-text text-sm placeholder-subtle focus:outline-none focus:border-primary transition-colors resize-none"
                />
              </Question>
            </div>
          )}

          {/* ── Review & Generate ── */}
          {currentStep === "review" && (
            <div className="space-y-5">
              <p className="text-muted text-sm">{meta.desc}</p>
              <div className="space-y-2 text-sm">
                {([
                  ["Name", name || "(not set)"],
                  ["OS", os],
                  ["Use case", useCase ?? ""],
categories.size > 0 && ["Focus areas", Array.from(categories).map(c => CATEGORIES.find(x => x.id === c)?.label).filter(Boolean).join(", ")],
                  (googleGmail || microsoftOutlook) && ["Email", [googleGmail && "Gmail", microsoftOutlook && "Outlook"].filter(Boolean).join(", ")],
                  emailAccounts.filter(a => a.email.trim()).length > 0 && ["Accounts", emailAccounts.filter(a => a.email.trim()).map(a => `${a.email} (${a.account_type})`).join(", ")],
                  (googleCalendar || microsoftCalendar) && ["Calendar", [googleCalendar && "Google Calendar", microsoftCalendar && "Microsoft Calendar"].filter(Boolean).join(", ")],
                  noteTakingTool && noteTakingTool !== "none" && ["Notes", noteTakingTool === "other" ? `Other: ${noteTakingOther}` : noteTakingTool.charAt(0).toUpperCase() + noteTakingTool.slice(1)],
                  wantsBriefings && briefings.filter(b => b.title).length > 0 && ["Briefings", briefings.filter(b => b.title).map(b => `${b.title} at ${b.preferred_time}`).join(", ")],
                  messagingApp && ["Messaging", messagingApp.charAt(0).toUpperCase() + messagingApp.slice(1)],
                  creativeTools.size > 0 && ["Creative", Array.from(creativeTools).map(t => CREATIVE_TOOLS.find(x => x.id === t)?.label).filter(Boolean).join(", ")],
                  financeTools.size > 0 && ["Finance", [...Array.from(financeTools).map(t => FINANCE_TOOLS.find(x => x.id === t)?.label).filter(Boolean), financeOther || null].filter(Boolean).join(", ")],
                  goal && ["Goal", `"${goal.length > 80 ? goal.slice(0, 80) + "…" : goal}"`],
                ] as (string[] | false)[]).filter(Boolean).map((row) => {
                  const [label, value] = row as [string, string];
                  return (
                    <div key={label} className="flex gap-2">
                      <span className="text-muted w-24 flex-shrink-0">{label}</span>
                      <span className="text-text italic text-xs leading-5">{value}</span>
                    </div>
                  );
                })}
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-error text-xs">{error}</div>
              )}
            </div>
          )}

        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={goBack}
            disabled={safeIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} /> Back
          </button>

          {currentStep !== "review" ? (
            <button
              onClick={goNext}
              disabled={!canAdvance()}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
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
