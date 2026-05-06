import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import StepList from "@/components/step-list";
import { SECTION_LABELS, SECTION_ORDER } from "@/lib/types";
import type { SetupStep, StepSection } from "@/lib/types";

export default async function GuidePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: guide } = await supabase
    .from("setup_guides")
    .select("id, generated_at")
    .eq("user_id", user.id)
    .single();

  if (!guide) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10 text-center">
        <div className="text-4xl mb-3">📋</div>
        <h1 className="text-xl font-bold text-white mb-2">No guide yet</h1>
        <p className="text-muted text-sm mb-5">Complete the setup questionnaire to generate your personalized guide.</p>
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
        >
          Start questionnaire
        </Link>
      </div>
    );
  }

  const { data: steps } = await supabase
    .from("setup_steps")
    .select("*")
    .eq("guide_id", guide.id)
    .order("step_number");

  const totalSteps = steps?.length ?? 0;
  const completedSteps = steps?.filter(s => s.status === "complete" || s.status === "skipped").length ?? 0;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // Group by section in canonical order
  const bySection: Record<string, SetupStep[]> = {};
  for (const s of SECTION_ORDER) {
    const sectionSteps = steps?.filter((step: SetupStep) => step.section === s) ?? [];
    if (sectionSteps.length > 0) bySection[s] = sectionSteps;
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">Your Setup Guide</h1>
          <p className="text-muted text-sm">{completedSteps} of {totalSteps} steps complete</p>
        </div>
        <Link
          href="/onboarding"
          className="text-xs text-muted hover:text-primary transition-colors"
        >
          Regenerate
        </Link>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-muted mb-1.5">
          <span>Progress</span><span>{progressPct}%</span>
        </div>
        <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {Object.entries(bySection).map(([section, sectionSteps]) => (
          <div key={section}>
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              {SECTION_LABELS[section as StepSection] ?? section}
            </h2>
            <StepList steps={sectionSteps} />
          </div>
        ))}
      </div>
    </div>
  );
}
