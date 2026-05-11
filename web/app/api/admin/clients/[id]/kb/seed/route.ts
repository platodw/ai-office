import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import Anthropic from "@anthropic-ai/sdk";

type Params = { params: Promise<{ id: string }> };

async function fetchReadme(repoUrl: string, token: string): Promise<string | null> {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!match) return null;
  const [, owner, repo] = match;
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw" },
    });
    if (!res.ok) return null;
    return (await res.text()).slice(0, 6000);
  } catch { return null; }
}

export async function POST(_request: Request, { params }: Params) {
  await requireAdmin();
  const { id: clientId } = await params;
  const supabase = await createClient();
  const admin    = createServiceClient();

  const [
    { data: client },
    { data: contacts },
    { data: apps },
    { data: services },
    { data: apiConfigs },
    { data: techInfo },
  ] = await Promise.all([
    supabase.from("clients").select("name, status, website, notes, onboarded_at, github_org").eq("id", clientId).single(),
    supabase.from("client_contacts").select("name, role, email, phone, is_primary").eq("client_id", clientId),
    supabase.from("client_apps").select("name, description, status, production_url, staging_url, repo_url, hosting, tech_stack, launched_at").eq("client_id", clientId),
    supabase.from("client_services").select("name, type, amount_cents, billing_start, billing_end, status").eq("client_id", clientId),
    supabase.from("client_api_configs").select("provider, display_name, external_id, is_active").eq("client_id", clientId),
    supabase.from("client_tech_info").select("domain_registrar, dns_provider, hosting_provider, it_service_provider, notes").eq("client_id", clientId).maybeSingle(),
  ]);

  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });

  // Best-effort: pull READMEs for any deployed apps with a repo URL.
  const ghToken = process.env.GITHUB_TOKEN ?? "";
  const repoReadmes: { app: string; readme: string }[] = [];
  if (ghToken && apps?.length) {
    for (const a of apps.slice(0, 6)) {
      if (!a.repo_url) continue;
      const readme = await fetchReadme(a.repo_url, ghToken);
      if (readme) repoReadmes.push({ app: a.name, readme });
    }
  }

  const context = {
    client,
    contacts,
    apps,
    services,
    api_configs: apiConfigs,
    tech_info: techInfo,
    repo_readmes: repoReadmes,
  };

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 8000,
    messages: [{
      role: "user",
      content: `You are seeding the per-client knowledge base for ${client.name}, an AI Office client.

Below is everything currently known about this client from the AI Office database, plus READMEs from their deployed app repos.

Generate 5 to 12 knowledge base articles that the client's portal users would actually find useful. Cover things like:
- What each deployed app is for and how it's set up (one article per app)
- Account overview: services, primary contact, status
- Practical "how do I" content derived from app READMEs (logging in, using key features, who to contact for what)
- Anything else the data implies a user would ask about

Each article should be:
- title: short, specific, action-oriented
- category: one of "apps" | "account" | "billing" | "how_to" | "tech"
- tags: 2-5 lowercase tags
- content: clean markdown, no preamble, no "this article will...". 200-600 words ideal.

Return ONLY a JSON array of articles. No markdown fences, no explanation.

Context:
${JSON.stringify(context, null, 2)}`,
    }],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  let articles: { title: string; category: string; tags: string[]; content: string }[];
  try {
    articles = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: "Claude returned unparseable JSON", raw: text.slice(0, 1000) }, { status: 500 });
  }

  // Clear previously-seeded articles for this client and re-insert.
  await admin.from("kb_articles").delete().eq("client_id", clientId).eq("source", "seeded");

  const rows = articles.map((a) => ({
    title: a.title,
    content: a.content,
    category: a.category,
    tags: a.tags ?? [],
    is_published: true,
    client_id: clientId,
    source: "seeded",
  }));
  const { error: insertErr } = await admin.from("kb_articles").insert(rows);
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({
    count: rows.length,
    repo_readmes_used: repoReadmes.length,
    input_tokens: message.usage.input_tokens,
    output_tokens: message.usage.output_tokens,
  });
}
