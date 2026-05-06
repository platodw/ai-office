import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { STEP_TEMPLATES } from "@/lib/steps-template";
import type { QuestionnaireResponses } from "@/lib/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { responses }: { responses: QuestionnaireResponses } = await request.json();

    // Filter template steps to only those relevant for this user
    const relevantTemplates = STEP_TEMPLATES.filter(t => !t.showIf || t.showIf(responses));

    // Build OS-specific code content into each template
    const templatesWithCode = relevantTemplates.map(t => ({
      ...t,
      code: t.codeContent?.[responses.os] ?? t.codeContent?.mac ?? null,
    }));

    const googleSummary = responses.google_enabled
      ? `Google connected: ${[
          responses.google_calendar && "Calendar",
          responses.google_gmail && "Gmail",
          responses.google_drive && "Drive",
        ].filter(Boolean).join(", ")}. Accounts: ${
          responses.google_accounts.map(a => `${a.email} (${a.type})`).join(", ") || "not specified"
        }`
      : "Google not connecting";

    const systemPrompt = `You are generating a personalized Claude setup guide for a user.

User profile:
- Name: ${responses.name || "the user"}
- OS: ${responses.os}
- Use cases: ${responses.use_cases.join(", ") || "general use"}
- ${googleSummary}
- Additional tools: ${responses.integrations.join(", ") || "none selected"}

Your job: take the template steps below and return them as a JSON array, with each step personalized for this user's specific setup.

Personalization rules:
- Use the user's name, OS, and email addresses where relevant
- Adjust click_steps for their specific OS where needed (e.g., PowerShell vs Terminal)
- If they have multiple Google accounts, mention adding each account separately
- Keep descriptions focused and direct — no filler
- Do not add steps that aren't in the templates

Return ONLY a valid JSON array with this exact structure per step (no markdown, no explanation):
[{
  "id": string,
  "section": string,
  "title": string,
  "description": string,
  "why": string,
  "click_steps": string[],
  "code": string | null,
  "notes": string[],
  "links": [{"label": string, "url": string}],
  "target_urls": string[],
  "completion_criteria": string
}]

Template steps to personalize:
${JSON.stringify(templatesWithCode, null, 2)}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      messages: [{ role: "user", content: "Generate my personalized setup guide." }],
      system: systemPrompt,
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected response type");

    let steps: Record<string, unknown>[];
    try {
      const text = content.text.trim();
      const jsonStart = text.indexOf("[");
      const jsonEnd = text.lastIndexOf("]") + 1;
      steps = JSON.parse(text.slice(jsonStart, jsonEnd));
    } catch {
      // Fall back to template steps without personalization
      steps = templatesWithCode.map(t => ({
        id: t.id,
        section: t.section,
        title: t.title,
        description: t.description,
        why: t.why,
        click_steps: t.click_steps,
        code: t.codeContent?.[responses.os] ?? null,
        notes: t.notes,
        links: t.links,
        target_urls: t.target_urls,
        completion_criteria: t.completion_criteria,
      }));
    }

    // Create guide record
    const { data: guide, error: guideError } = await supabase
      .from("setup_guides")
      .upsert({ user_id: user.id, generated_at: new Date().toISOString() }, { onConflict: "user_id" })
      .select()
      .single();

    if (guideError || !guide) throw new Error("Failed to create guide");

    // Delete existing steps if regenerating
    await supabase.from("setup_steps").delete().eq("guide_id", guide.id);

    // Insert steps
    const stepRows = steps.map((s, idx) => ({
      guide_id: guide.id,
      step_number: idx + 1,
      section: s.section,
      title: s.title,
      description: s.description,
      why: s.why,
      click_steps: s.click_steps ?? [],
      code_blocks: s.code ? [{ content: s.code }] : [],
      notes: s.notes ?? [],
      links: s.links ?? [],
      target_urls: s.target_urls ?? [],
      completion_criteria: s.completion_criteria,
      status: "pending",
    }));

    const { error: stepsError } = await supabase.from("setup_steps").insert(stepRows);
    if (stepsError) throw new Error("Failed to insert steps");

    return NextResponse.json({ ok: true, guide_id: guide.id, step_count: steps.length });
  } catch (err: unknown) {
    console.error("Guide generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate guide" },
      { status: 500 }
    );
  }
}
