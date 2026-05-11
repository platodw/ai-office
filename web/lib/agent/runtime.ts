import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { kbSearchTool, runKbSearch } from "./tools/kb-search";
import {
  listAppsTool,        runListApps,
  listContactsTool,    runListContacts,
  listServicesTool,    runListServices,
  recentInvoicesTool,  runRecentInvoices,
  accountOverviewTool, runAccountOverview,
} from "./tools/client-data";
import {
  escalateToAdminTool,         runEscalateToAdmin,
  proposeCreatePortalUserTool, runProposeCreatePortalUser,
} from "./tools/actions";

// Pricing per 1M tokens (USD). Keep this aligned with the model we use.
const MODEL = "claude-opus-4-7";
const PRICE_INPUT_PER_1M  = 5.00;
const PRICE_OUTPUT_PER_1M = 25.00;

const SYSTEM_PROMPT = `You are the AI Office support agent for ${"{client_name}"}.

You help portal users with questions about their setup, their deployed apps, and their account. You're conversational and direct — no corporate filler, no "I'd be happy to". Get to the point.

Never refer to any specific person by name (not Dan, not any team member). When referring to the humans behind AI Office, always say "the Support team" or "we". This applies to both the message body and any escalation summaries.

You have these read tools for live data about this client:
- account_overview: client name, status, primary contact, app/service counts
- list_apps: deployed apps with URLs, hosting, tech stack
- list_contacts: people on file
- list_services: active retainers and one-time projects
- recent_invoices: recent billing
- kb_search: per-client and global help articles

For state-changing requests, you have these action tools. They never execute directly — they submit a request to the Support team for approval:
- propose_create_portal_user: when the user asks to invite a teammate / give someone portal access
- escalate_to_admin: when the user has an issue you can't resolve, a complaint, or asks for a human

Rules:
- Use the read tools instead of guessing. If a fact lives in those tools, call them.
- Search the knowledge base for generic "how do I" or setup questions.
- For state-changing requests, call the appropriate action tool. Tell the user "I've flagged this for the Support team — they'll review and follow up." Don't pretend the action is already done.
- If the user is upset or stuck and the situation is beyond what the tools cover, call escalate_to_admin with a summary.
- Keep replies short. Long answers should be paragraphs, not headers and bullet lists.
- Do not use markdown formatting in replies. No **bold**, no *italics*, no \`code spans\`, no headers, no bullet lists. Write plain prose. The chat panel renders text literally, so markdown characters show up as junk.`;

export type ChatTurn = {
  role: "user" | "assistant";
  content: Anthropic.MessageParam["content"];
};

export type AgentContext = {
  supabase: SupabaseClient;
  clientId: string;
  clientName: string;
  conversationId: string;
  apiKey: string;
};

export type AgentMessageRecord = {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls?: unknown;
  tool_results?: unknown;
  input_tokens?: number;
  output_tokens?: number;
  cost_cents?: number;
  model?: string;
};

const TOOLS = [
  kbSearchTool,
  listAppsTool,
  listContactsTool,
  listServicesTool,
  recentInvoicesTool,
  accountOverviewTool,
  escalateToAdminTool,
  proposeCreatePortalUserTool,
] as const;

export async function runTurn(
  ctx: AgentContext,
  history: ChatTurn[],
  userText: string,
): Promise<{
  finalText: string;
  records: AgentMessageRecord[];
}> {
  const client = new Anthropic({ apiKey: ctx.apiKey });
  const records: AgentMessageRecord[] = [];

  // Persist the user turn first.
  records.push({ role: "user", content: userText });

  const messages: Anthropic.MessageParam[] = [
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: userText },
  ];

  const system = SYSTEM_PROMPT.replace("{client_name}", ctx.clientName);

  // Manual agent loop so we can persist tool calls/results and accumulate cost.
  let finalText = "";
  for (let iter = 0; iter < 5; iter++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system,
      tools: TOOLS as unknown as Anthropic.Tool[],
      messages,
    });

    const inputTokens  = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const costCents =
      (inputTokens  * PRICE_INPUT_PER_1M  / 1_000_000 +
       outputTokens * PRICE_OUTPUT_PER_1M / 1_000_000) * 100;

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    // Iterations where the model only called a tool (no user-visible text)
    // get persisted as role='tool' so the chat UI skips them — only real
    // assistant text gets bubbles. Token cost still recorded for accounting.
    records.push({
      role: text ? "assistant" : "tool",
      content: text,
      tool_calls: toolUses.length ? toolUses : undefined,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_cents: Number(costCents.toFixed(4)),
      model: MODEL,
    });

    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      finalText = text;
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tool of toolUses) {
      const result = await dispatchTool(ctx, tool.name, tool.input);
      toolResults.push({
        type: "tool_result",
        tool_use_id: tool.id,
        content: JSON.stringify(result),
      });
    }

    records.push({
      role: "tool",
      content: "",
      tool_results: toolResults,
    });

    messages.push({ role: "user", content: toolResults });
  }

  return { finalText, records };
}

async function dispatchTool(ctx: AgentContext, name: string, input: unknown): Promise<unknown> {
  const { supabase, clientId, conversationId } = ctx;
  const approvalCtx = { supabase, clientId, conversationId };
  switch (name) {
    case "kb_search":                   return runKbSearch(supabase, clientId, input as { query: string; limit?: number });
    case "list_apps":                   return runListApps(supabase, clientId);
    case "list_contacts":               return runListContacts(supabase, clientId);
    case "list_services":               return runListServices(supabase, clientId);
    case "recent_invoices":             return runRecentInvoices(supabase, clientId);
    case "account_overview":            return runAccountOverview(supabase, clientId);
    case "escalate_to_admin":           return runEscalateToAdmin(approvalCtx, input as { title: string; description: string });
    case "propose_create_portal_user":  return runProposeCreatePortalUser(approvalCtx, input as { email: string; name?: string; role: "power_user" | "billing" | "viewer" });
    default:                            return { error: `Unknown tool: ${name}` };
  }
}
