import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const supabase = createServiceClient();

  const { data: tokenRow } = await supabase
    .from("extension_tokens")
    .select("user_id")
    .eq("token", token)
    .single();

  if (!tokenRow) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  // Update last_used_at
  await supabase
    .from("extension_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token", token);

  // Get current pending step
  const { data: guide } = await supabase
    .from("setup_guides")
    .select("id")
    .eq("user_id", tokenRow.user_id)
    .single();

  let currentStep = null;
  let totalSteps = 0;
  let completedSteps = 0;

  if (guide) {
    const { data: steps } = await supabase
      .from("setup_steps")
      .select("id, step_number, section, title, description, target_urls, status")
      .eq("guide_id", guide.id)
      .order("step_number");

    if (steps) {
      totalSteps = steps.length;
      completedSteps = steps.filter((s: { status: string }) => s.status === "complete" || s.status === "skipped").length;
      currentStep = steps.find((s: { status: string }) => s.status === "pending" || s.status === "in_progress") ?? null;
    }
  }

  return NextResponse.json({
    connected: true,
    has_guide: !!guide,
    current_step: currentStep,
    progress: { total: totalSteps, completed: completedSteps },
  });
}
