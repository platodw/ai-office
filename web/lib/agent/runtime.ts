import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { kbSearchTool, runKbSearch } from "./tools/kb-search";

// Pricing per 1M tokens (USD). Keep this aligned with the model we use.
const MODEL = "claude-opus-4-7";
const PRICE_INPUT_PER_1M  = 5.00;
const PRICE_OUTPUT_PER_1M = 25.00;

const SYSTEM_PROMPT = `You are the AI Office support agent for ${"{client_name}"}, a client of Dan Plato Consulting.

You help portal users with questions about their setup, their deployed apps, and their account. You're conversational and direct — no corporate filler, no "I'd be happy to". Get to the point.

Rules:
- Search the knowledge base before answering generic "how do I" questions.
- If you don't know something, say so. Don't invent facts about the user's apps or account.
- For anything that would change data or require human review (creating users, code changes, refunds, etc.), tell the user you'll need to flag it for the Support team. Don't pretend you can do it yourself yet — those tools are coming in a later step.
- Keep replies short. Long answers should be paragraphs, not headers and bullet lists.`;

export type ChatTurn = {
  role: "user" | "assistant";
  content: Anthropic.MessageParam["content"];
};

export type AgentContext = {
  supabase: SupabaseClient;
  clientId: string;
  clientName: string;
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

const TOOLS = [kbSearchTool] as const;

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

    records.push({
      role: "assistant",
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
      let result: unknown;
      if (tool.name === "kb_search") {
        result = await runKbSearch(ctx.supabase, tool.input as { query: string; limit?: number });
      } else {
        result = { error: `Unknown tool: ${tool.name}` };
      }
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
