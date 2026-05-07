import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { STEP_TEMPLATES } from "@/lib/steps-template";
import type { QuestionnaireResponses } from "@/lib/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildUserProfile(r: QuestionnaireResponses): string {
  const lines: string[] = [
    `Name: ${r.name || "the user"}`,
    `OS: ${r.os}`,
    `Use case: ${r.use_case}`,
    `Technical comfort: ${r.technical_comfort} (${
      r.technical_comfort === "beginner" ? "needs detailed explanations" :
      r.technical_comfort === "intermediate" ? "familiar with terminals and config files" :
      "developer — keep it concise"
    })`,
    `Claude account: ${r.has_claude_account ? "yes" : "not yet — first step is signing up"}`,
    `Claude Desktop installed: ${r.has_claude_desktop ? "yes" : "no — needs to install it"}`,
    `Admin access: ${r.has_admin_access ? "yes, full" : "limited or IT-managed — flag admin-required steps"}`,
  ];

  if (r.email_accounts.length > 0) {
    const accountSummary = r.email_accounts.map(a => {
      const parts = [`${a.email} (${a.provider}, ${a.account_type})`];
      if (a.account_type === "work" && a.has_admin_control) parts.push("has admin control");
      else if (a.account_type === "work") parts.push("no admin control — flag IT coordination");
      return parts.join(", ");
    }).join("; ");
    lines.push(`Email accounts: ${accountSummary}`);
  }

  const calServices = [
    r.google_calendar && "Google Calendar",
    r.microsoft_calendar && "Microsoft Calendar",
  ].filter(Boolean);
  if (calServices.length) lines.push(`Calendar: ${calServices.join(", ")}`);

  const storageServices = [
    r.google_drive && "Google Drive",
    r.microsoft_sharepoint && "SharePoint / OneDrive",
  ].filter(Boolean);
  if (storageServices.length) lines.push(`File storage: ${storageServices.join(", ")}`);

  if (r.note_taking_tool && r.note_taking_tool !== "none") {
    const tool = r.note_taking_tool === "other" ? `Other: ${r.note_taking_other}` : r.note_taking_tool;
    lines.push(`Note-taking: ${tool}`);
  } else if (r.wants_note_taking_setup) {
    lines.push("Note-taking: wants Granola setup");
  }

  if (r.wants_briefings && r.briefings.length > 0) {
    const briefingDetails = r.briefings.map(b =>
      `"${b.title}" at ${b.preferred_time}${b.topics.length ? ` covering ${b.topics.join(", ")}` : ""}`
    ).join("; ");
    lines.push(`Daily briefings: ${briefingDetails}`);
  } else if (r.wants_briefings) {
    lines.push("Daily briefings: yes (titles/times not specified)");
  }

  if (r.wants_action_items) {
    const delivery = r.action_item_delivery.length > 0 ? r.action_item_delivery.join(", ") : "not specified";
    lines.push(`Action items: yes — surface via ${delivery}`);
  }

  if (r.messaging_app) lines.push(`Phone messaging: ${r.messaging_app}`);
  if (r.pkb) lines.push("Persistent memory (PKB): yes");

  if (r.wants_doc_editing || r.wants_file_organization) {
    const docs = [r.wants_doc_editing && "document editing", r.wants_file_organization && "file organization"].filter(Boolean);
    lines.push(`Documents & files: ${docs.join(", ")}`);
  }

  if (r.wants_app_dev || r.github || r.supabase_db || r.vercel) {
    lines.push(`App development: ${r.wants_app_dev ? "yes" : "tools only"}`);
    const devTools = [r.github && "GitHub", r.supabase_db && "Supabase", r.vercel && "Vercel"].filter(Boolean);
    if (devTools.length) lines.push(`Dev tools: ${devTools.join(", ")}`);
    if (r.wants_app_dev) {
      if (r.apps_publicly_accessible !== null) lines.push(`Apps publicly accessible: ${r.apps_publicly_accessible ? "yes" : "no"}`);
      if (r.apps_need_data_storage !== null) lines.push(`Apps need data storage: ${r.apps_need_data_storage ? "yes" : "no"}`);
      if (r.app_user_count) lines.push(`Expected users: ${r.app_user_count}`);
    }
  }

  if (r.creative_tools.length) lines.push(`Creative tools: ${r.creative_tools.join(", ")}`);

  if (r.finance_tools.length || r.finance_other) {
    const finance = [...r.finance_tools, r.finance_other].filter(Boolean);
    lines.push(`Finance tools: ${finance.join(", ")}`);
  }

  if (r.goal) lines.push(`User's stated goal: "${r.goal}"`);

  return lines.map(l => `- ${l}`).join("\n");
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { responses }: { responses: QuestionnaireResponses } = await request.json();

    const relevantTemplates = STEP_TEMPLATES.filter(t => !t.showIf || t.showIf(responses));
    const templatesWithCode = relevantTemplates.map(t => ({
      ...t,
      code: t.codeContent?.[responses.os] ?? t.codeContent?.mac ?? null,
      showIf: undefined,
      codeContent: undefined,
    }));

    const systemPrompt = `You are generating a personalized Claude setup guide.

User profile:
${buildUserProfile(responses)}

Your job: take the template steps below and return them as a JSON array, with each step personalized for this user's specific setup.

Personalization rules:
- Address the user by name (${responses.name || "the user"}) in the first step description
- Adjust click_steps for their OS: "${responses.os}" (use PowerShell on Windows, Terminal on Mac)
- For beginners: expand explanations, add reassurance, use plain language
- For power users: be concise, skip obvious context, use technical shorthand
- If no Claude account yet, prominently note in step 1 that signing up is required first
- If not yet on Claude Desktop, note in the claude-desktop step that installing it is the starting point
- If limited admin access, add a note to affected steps: "Flagged: requires admin access — coordinate with IT if needed"
- If work accounts lack admin control, flag the Google OAuth and connector steps accordingly
- If they have multiple email accounts, mention adding each account separately in the Google/Outlook steps
- Reference their specific briefing titles and times in the scheduled-workflows step
- In the file-system-mcp and desktop-commander steps, explain why these are included based on their specific use cases
- Reference the user's stated goal in the first step's description and the final step
- Keep descriptions focused and direct — no filler phrases

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
      steps = templatesWithCode.map(t => ({
        id: t.id,
        section: t.section,
        title: t.title,
        description: t.description,
        why: t.why,
        click_steps: t.click_steps,
        code: t.code ?? null,
        notes: t.notes,
        links: t.links,
        target_urls: t.target_urls,
        completion_criteria: t.completion_criteria,
      }));
    }

    const { data: guide, error: guideError } = await supabase
      .from("setup_guides")
      .upsert({ user_id: user.id, generated_at: new Date().toISOString() }, { onConflict: "user_id" })
      .select()
      .single();

    if (guideError || !guide) throw new Error("Failed to create guide");

    await supabase.from("setup_steps").delete().eq("guide_id", guide.id);

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
