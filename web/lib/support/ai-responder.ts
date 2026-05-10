// AI-first support responder.
// Searches the KB for relevant articles, then asks Claude to answer.
// Returns a structured result indicating confidence so the caller can
// decide whether to auto-close the ticket or escalate to Dan.

import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/service";

export interface AIResponse {
  answer:       string;
  confident:    boolean;
  articleIds:   string[];
  inputTokens:  number;
  outputTokens: number;
}

type KBArticle = { id: string; title: string; content: string; category: string | null };

// Simple term-based search — good enough for a small KB.
async function searchKB(query: string): Promise<KBArticle[]> {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 4);

  if (!terms.length) return [];

  const supabase = createServiceClient();

  const orFilters = terms
    .flatMap((t) => [`title.ilike.%${t}%`, `content.ilike.%${t}%`])
    .join(",");

  const { data } = await supabase
    .from("kb_articles")
    .select("id, title, content, category")
    .eq("is_published", true)
    .or(orFilters)
    .limit(4);

  return (data ?? []) as KBArticle[];
}

export async function generateSupportResponse(
  ticketTitle: string,
  ticketBody: string,
): Promise<AIResponse> {
  const articles = await searchKB(`${ticketTitle} ${ticketBody}`);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const client = new Anthropic({ apiKey });

  const kbContext = articles.length
    ? articles
        .map((a) => `## ${a.title}${a.category ? ` (${a.category})` : ""}\n\n${a.content}`)
        .join("\n\n---\n\n")
    : "No relevant articles found in the knowledge base.";

  const system = `You are an AI support agent for AI Office, a managed AI service for small businesses.

Use the knowledge base below to answer client support questions. Be concise and practical.

Knowledge base:
${kbContext}

Respond in exactly this format — no other text:

<answer>
Your answer in markdown.
</answer>
<confidence>HIGH or LOW</confidence>

Use HIGH when the KB directly answers the question.
Use LOW when the question requires account-specific details, billing information, or Dan's direct involvement.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: `Subject: ${ticketTitle}\n\n${ticketBody}` }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  const answerMatch     = raw.match(/<answer>([\s\S]*?)<\/answer>/);
  const confidenceMatch = raw.match(/<confidence>(HIGH|LOW)<\/confidence>/);

  return {
    answer:       answerMatch?.[1]?.trim() ?? raw.trim(),
    confident:    confidenceMatch?.[1] === "HIGH",
    articleIds:   articles.map((a) => a.id),
    inputTokens:  message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}
