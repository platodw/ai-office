import type { SupabaseClient } from "@supabase/supabase-js";

export const kbSearchTool = {
  name: "kb_search",
  description:
    "Search the AI Office knowledge base for articles relevant to the user's question. Use this when the user asks how something works, how to set up a feature, or for general 'how do I' questions about their AI Office setup.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Plain-language search query, e.g. 'reset password' or 'connect Gmail'",
      },
      limit: {
        type: "integer",
        description: "Max number of articles to return. Default 3.",
      },
    },
    required: ["query"],
  },
} as const;

export async function runKbSearch(
  supabase: SupabaseClient,
  clientId: string,
  input: { query: string; limit?: number },
) {
  const limit = input.limit ?? 3;
  const pattern = `%${input.query.replace(/[%_]/g, (c) => `\\${c}`)}%`;
  const { data, error } = await supabase
    .from("kb_articles")
    .select("id, title, content, category, client_id")
    .eq("is_published", true)
    .or(`client_id.is.null,client_id.eq.${clientId}`)
    .or(`title.ilike.${pattern},content.ilike.${pattern}`)
    .limit(limit);

  if (error) {
    return { error: error.message, articles: [] };
  }

  return {
    articles: (data ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      category: a.category,
      scope: a.client_id ? "client" : "global",
      content: a.content.slice(0, 2000),
    })),
  };
}
