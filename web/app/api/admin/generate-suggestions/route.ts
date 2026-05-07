import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { STEP_TEMPLATES } from "@/lib/steps-template";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ANALYZER_SYSTEM = `You are reviewing anonymous user questions from a setup-guide chat to find clear instruction-quality bugs.

For each question, decide:
1. Does the question reveal that the current step's instructions are unclear, missing, or hard to follow? (Versus the user just asking for adjacent help, off-topic chatter, or things that aren't the instructions' fault.)
2. Is there a clear, low-effort edit to the step's instructions that would prevent this question? (Reword a click_step, clarify a description, add a note. Not a redesign.)

If both are yes, propose ONE specific edit. Always quote the EXACT current text from the step (verbatim) so the edit can be applied programmatically.

Output a JSON array. One element per HIGH-CONFIDENCE suggestion (skip everything else):
[{
  "step_id": string,
  "field": "description" | "why" | "click_steps" | "notes",
  "field_index": number | null,    // for click_steps/notes, the 0-based index within the array; null for description/why
  "current_value": string,          // EXACT current text, verbatim
  "proposed_value": string,
  "rationale": string,              // one sentence on why this edit helps
  "triggering_question": string,
  "confidence": 4 | 5
}]

Skip questions that are:
- Off-topic or unrelated to the step
- Asking the assistant to do something for them (rather than reflecting unclear instructions)
- Already well-covered by the existing instructions
- Implying a fix that would require redesign, not a wording tweak

If no clear suggestions, return [].`;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Pull last 7 days of telemetry, grouped by step.
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events } = await supabase
    .from("chat_telemetry")
    .select("id, step_id, scrubbed_prompt, page_domain, created_at")
    .gte("created_at", sinceIso)
    .not("step_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (!events || events.length === 0) {
    return NextResponse.json({ ok: true, analyzed: 0, suggestions: 0, note: "No recent telemetry" });
  }

  // Pull existing pending suggestions so we don't propose duplicates of recent
  // questions that haven't been reviewed yet.
  const { data: existing } = await supabase
    .from("template_suggestions")
    .select("triggering_question")
    .eq("status", "pending");
  const seenQuestions = new Set((existing || []).map(s => s.triggering_question));

  // The extension sends the setup_steps.id (DB UUID), not the template id, so
  // resolve UUID → title → template. We cache the title lookup per step_id.
  const stepIds = [...new Set(events.map(e => e.step_id).filter((x): x is string => !!x))];
  const titleByStepId: Record<string, string> = {};
  if (stepIds.length > 0) {
    const { data: rows } = await supabase
      .from("setup_steps")
      .select("id, title")
      .in("id", stepIds);
    for (const r of rows || []) titleByStepId[r.id] = r.title;
  }

  function templateFor(stepId: string) {
    // Allow either the raw template id (future-proof) or a UUID resolved by title.
    const direct = STEP_TEMPLATES.find(t => t.id === stepId);
    if (direct) return direct;
    const title = titleByStepId[stepId];
    if (!title) return null;
    return STEP_TEMPLATES.find(t => t.title === title) || null;
  }

  // Group by step_id and analyze each batch.
  const byStep: Record<string, typeof events> = {};
  for (const e of events) {
    if (!e.step_id) continue;
    if (seenQuestions.has(e.scrubbed_prompt)) continue;
    (byStep[e.step_id] ||= []).push(e);
  }

  const allSuggestions: Record<string, unknown>[] = [];
  let analyzed = 0;

  for (const [stepId, stepEvents] of Object.entries(byStep)) {
    const template = templateFor(stepId);
    if (!template) continue;

    const prompt = `Step template:
${JSON.stringify({
  id: template.id,
  title: template.title,
  description: template.description,
  why: template.why,
  click_steps: template.click_steps,
  notes: template.notes,
}, null, 2)}

Recent user questions while on this step:
${stepEvents.slice(0, 20).map((e, i) => `${i + 1}. (domain: ${e.page_domain || "unknown"}) ${e.scrubbed_prompt}`).join("\n")}`;

    analyzed += stepEvents.length;

    try {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
        system: ANALYZER_SYSTEM,
      });
      const content = message.content[0];
      if (content.type !== "text") continue;

      const text = content.text.trim();
      const jsonStart = text.indexOf("[");
      const jsonEnd = text.lastIndexOf("]") + 1;
      if (jsonStart === -1 || jsonEnd <= jsonStart) continue;
      const parsed: Record<string, unknown>[] = JSON.parse(text.slice(jsonStart, jsonEnd));
      for (const s of parsed) {
        if ((s.confidence as number) < 4) continue;
        allSuggestions.push(s);
      }
    } catch (err) {
      console.error(`Analyzer failed for step ${stepId}:`, err);
    }
  }

  if (allSuggestions.length === 0) {
    return NextResponse.json({ ok: true, analyzed, suggestions: 0 });
  }

  const rows = allSuggestions.map(s => {
    const fieldIdx = s.field_index === null || s.field_index === undefined
      ? null
      : Number(s.field_index);
    const fieldLabel = fieldIdx !== null
      ? `${s.field}[${fieldIdx}]`
      : String(s.field);
    return {
      step_id: String(s.step_id),
      field: fieldLabel,
      current_value: String(s.current_value),
      proposed_value: String(s.proposed_value),
      rationale: String(s.rationale),
      triggering_question: String(s.triggering_question),
      confidence: Number(s.confidence),
    };
  });

  const { error } = await supabase.from("template_suggestions").insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, analyzed, suggestions: rows.length });
}
