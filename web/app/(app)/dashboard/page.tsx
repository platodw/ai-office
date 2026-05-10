import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import CopyToken from "@/components/copy-token";
import TelemetryToggle from "@/components/telemetry-toggle";
import { SECTION_LABELS } from "@/lib/types";

const INSTALLER_URL =
  "https://github.com/platodw/ai-office/releases/latest/download/aioffice-setup.exe";
const EXTENSION_INSTRUCTIONS_URL =
  "https://github.com/platodw/ai-office#install-the-chrome-extension";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: token }, { data: guide }] = await Promise.all([
    supabase.from("profiles").select("name, os, allow_telemetry, is_admin").eq("id", user.id).single(),
    supabase.from("extension_tokens").select("token").eq("user_id", user.id).single(),
    supabase.from("setup_guides").select("id, generated_at").eq("user_id", user.id).single(),
  ]);

  let steps = null;
  if (guide) {
    const { data } = await supabase
      .from("setup_steps")
      .select("id, section, title, status")
      .eq("guide_id", guide.id)
      .order("step_number");
    steps = data;
  }

  const totalSteps = steps?.length ?? 0;
  const completedSteps = steps?.filter(s => s.status === "complete" || s.status === "skipped").length ?? 0;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const currentStep = steps?.find(s => s.status === "pending" || s.status === "in_progress");

  // Group steps by section
  type StepRow = { id: string; section: string; title: string; status: string };
  const bySection = steps?.reduce((acc: Record<string, StepRow[]>, s: StepRow) => {
    if (!acc[s.section]) acc[s.section] = [];
    acc[s.section].push(s);
    return acc;
  }, {}) ?? {};

  const firstName = profile?.name?.split(" ")[0] || "there";

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text tracking-tight">Hello, {firstName}.</h1>
        <p className="text-muted text-sm mt-1">
          {guide
            ? `${completedSteps} of ${totalSteps} setup steps complete`
            : "Your setup guide is ready to generate."}
        </p>
      </div>

      {/* No guide yet */}
      {!guide && (
        <div className="bg-surface border border-border rounded-xl p-8 text-center mb-6">
          <h2 className="text-base font-semibold text-text mb-2">Generate your setup guide</h2>
          <p className="text-muted text-sm mb-5">Answer a few questions and we&apos;ll build a personalized Claude setup guide for you.</p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-text font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            Get started
          </Link>
        </div>
      )}

      {/* Progress */}
      {guide && steps && (
        <div className="bg-surface border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-text">Setup progress</span>
            <span className="text-sm text-muted">{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {currentStep && (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted mb-0.5">Next up</div>
                <div className="text-sm text-text font-medium">{currentStep.title}</div>
              </div>
              <Link
                href="/guide"
                className="text-xs text-primary hover:underline"
              >
                View guide →
              </Link>
            </div>
          )}
          {!currentStep && progressPct === 100 && (
            <div className="text-sm text-success font-medium">✓ All steps complete!</div>
          )}
        </div>
      )}

      {/* Section overview */}
      {guide && Object.keys(bySection).length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-text mb-3">Progress by section</h2>
          <div className="space-y-2">
            {Object.entries(bySection).map(([section, sectionSteps]) => {
              const done = (sectionSteps as StepRow[]).filter(s => s.status === "complete" || s.status === "skipped").length;
              const total = (sectionSteps as StepRow[]).length;
              const allDone = done === total;
              return (
                <div key={section} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${allDone ? "bg-success" : done > 0 ? "bg-warning" : "bg-subtle"}`} />
                    <span className={allDone ? "text-muted" : "text-text"}>
                      {SECTION_LABELS[section as keyof typeof SECTION_LABELS] ?? section}
                    </span>
                  </div>
                  <span className="text-muted text-xs">{done}/{total}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Get started */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-text mb-1">Get started</h2>
        <p className="text-muted text-sm mb-5">Three steps to connect AI Office to Claude on your computer.</p>

        <ol className="space-y-5">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-primary text-text rounded-full flex items-center justify-center text-xs font-semibold">1</span>
            <div className="flex-1">
              <div className="text-sm font-medium text-text">Install the Chrome extension</div>
              <p className="text-muted text-xs mt-0.5 mb-2">
                Adds the AI Office side panel to Chrome. Web Store listing coming soon — for now, load it in developer mode.
              </p>
              <a
                href={EXTENSION_INSTRUCTIONS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                Installation instructions <ExternalLink size={12} />
              </a>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-primary text-text rounded-full flex items-center justify-center text-xs font-semibold">2</span>
            <div className="flex-1">
              <div className="text-sm font-medium text-text">Download the AI Office installer</div>
              <p className="text-muted text-xs mt-0.5 mb-2">
                Lets the extension talk to Claude on your machine. Windows only for now.
              </p>
              <a
                href={INSTALLER_URL}
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-text font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <Download size={14} />
                Download for Windows
              </a>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-primary text-text rounded-full flex items-center justify-center text-xs font-semibold">3</span>
            <div className="flex-1">
              <div className="text-sm font-medium text-text">Paste your token into the extension</div>
              <p className="text-muted text-xs mt-0.5 mb-2">
                Open the AI Office side panel in Chrome and paste this token to link it to your account.
              </p>
              {token ? (
                <CopyToken token={token.token} />
              ) : (
                <div className="text-muted text-xs">Token not found. Try signing out and back in.</div>
              )}
            </div>
          </li>
        </ol>
      </div>

      {/* Privacy / telemetry toggle */}
      <div className="mt-6">
        <TelemetryToggle initial={!!profile?.allow_telemetry} userId={user.id} />
      </div>

      {profile?.is_admin && (
        <div className="mt-6 text-right">
          <Link href="/guide-suggestions" className="text-xs text-muted hover:text-primary transition-colors">
            Admin → Suggestions
          </Link>
        </div>
      )}
    </div>
  );
}
