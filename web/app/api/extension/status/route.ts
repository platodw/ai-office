import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401, headers: CORS });

  const supabase = createServiceClient();

  const { data: tokenRow } = await supabase
    .from("extension_tokens")
    .select("user_id")
    .eq("token", token)
    .single();

  if (!tokenRow) return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: CORS });

  const userId = tokenRow.user_id;

  // Update last_used_at and fetch all user data in parallel
  const [, profileResult, questionnaireResult, guideResult] = await Promise.all([
    supabase.from("extension_tokens").update({ last_used_at: new Date().toISOString() }).eq("token", token),
    supabase.from("profiles").select("name, os").eq("id", userId).single(),
    supabase.from("questionnaire_responses").select("responses").eq("user_id", userId).single(),
    supabase.from("setup_guides").select("id, generated_at").eq("user_id", userId).single(),
  ]);

  const profile = profileResult.data;
  const questionnaire = questionnaireResult.data?.responses ?? null;
  const guide = guideResult.data;

  let allSteps: object[] = [];
  let currentStep = null;

  if (guide) {
    const { data: steps } = await supabase
      .from("setup_steps")
      .select("id, step_number, section, title, description, status, target_urls")
      .eq("guide_id", guide.id)
      .order("step_number");

    if (steps) {
      allSteps = steps;
      currentStep = steps.find(s => s.status === "pending" || s.status === "in_progress") ?? null;
    }
  }

  const totalSteps = allSteps.length;
  const completedSteps = allSteps.filter((s: any) => s.status === "complete" || s.status === "skipped").length;

  return NextResponse.json({
    connected: true,
    has_guide: !!guide,
    profile,
    questionnaire,
    current_step: currentStep,
    all_steps: allSteps,
    progress: { total: totalSteps, completed: completedSteps },
  }, { headers: CORS });
}
