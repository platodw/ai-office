import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import CopyToken from "@/components/copy-token";
import { SECTION_LABELS } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: token }, { data: guide }] = await Promise.all([
    supabase.from("profiles").select("name, os").eq("id", user.id).single(),
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
        <h1 className="text-2xl font-bold text-white">Hey {firstName} 👋</h1>
        <p className="text-muted text-sm mt-1">
          {guide
            ? `${completedSteps} of ${totalSteps} setup steps complete`
            : "Your setup guide is ready to generate."}
        </p>
      </div>

      {/* No guide yet */}
      {!guide && (
        <div className="bg-surface border border-border rounded-xl p-8 text-center mb-6">
          <div className="text-4xl mb-3">📋</div>
          <h2 className="text-base font-semibold text-white mb-2">Generate your setup guide</h2>
          <p className="text-muted text-sm mb-5">Answer a few questions and we&apos;ll build a personalized Claude setup guide for your workflow.</p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            Get started
          </Link>
        </div>
      )}

      {/* Progress */}
      {guide && steps && (
        <div className="bg-surface border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-white">Setup progress</span>
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
          <h2 className="text-sm font-semibold text-white mb-3">Progress by section</h2>
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

      {/* Extension connection */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-1">Connect the Chrome extension</h2>
        <p className="text-muted text-sm mb-4">
          Paste this token into the AI Office extension to link it to your account.
          The extension will show your current setup step as you browse.
        </p>
        {token ? (
          <CopyToken token={token.token} />
        ) : (
          <div className="text-muted text-sm">Token not found. Try signing out and back in.</div>
        )}
        <div className="mt-4 p-3 bg-surface-2 rounded-lg border border-border">
          <div className="text-xs text-muted mb-1">Companion server</div>
          <div className="text-xs font-mono text-text">python server/server.py</div>
          <div className="text-xs text-muted mt-1">Start this on your machine before using the extension.</div>
        </div>
      </div>
    </div>
  );
}
