import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

type Params = { params: Promise<{ id: string }> };

async function ghFetch(url: string, token: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!res.ok) return null;
  return res.json();
}

async function getFileSafe(owner: string, repo: string, path: string, token: string): Promise<string | null> {
  try {
    const data = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, token);
    if (!data?.content) return null;
    return Buffer.from(data.content, "base64").toString("utf-8").slice(0, 4000);
  } catch { return null; }
}

export async function POST(request: Request, { params }: Params) {
  await requireAdmin();
  const { id: clientId } = await params;

  const body = await request.json().catch(() => ({}));
  const token: string = body.github_token ?? process.env.GITHUB_TOKEN ?? "";
  if (!token) return NextResponse.json({ error: "No GitHub token available. Set GITHUB_TOKEN in environment or pass github_token in the request body." }, { status: 400 });

  // Load the client to get github_org
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("name, github_org").eq("id", clientId).single();
  const org: string = body.github_org ?? client?.github_org ?? "";
  if (!org) return NextResponse.json({ error: "No GitHub org/user set for this client. Set github_org on the client first." }, { status: 400 });

  // Fetch repos for the org (try user first, then org endpoint)
  let repos = await ghFetch(`https://api.github.com/users/${org}/repos?per_page=50&sort=updated`, token);
  if (!repos) repos = await ghFetch(`https://api.github.com/orgs/${org}/repos?per_page=50&sort=updated`, token);
  if (!repos || !Array.isArray(repos)) return NextResponse.json({ error: `Could not fetch repos for ${org}. Check the GitHub org and token.` }, { status: 400 });

  // Filter out forks and archived repos
  const relevant = repos.filter((r: { fork: boolean; archived: boolean }) => !r.fork && !r.archived).slice(0, 20);

  // For each repo, grab key files to detect stack
  const repoData = await Promise.all(relevant.map(async (r: { name: string; description: string | null; homepage: string | null; language: string | null; html_url: string; pushed_at: string }) => {
    const [pkg, vercelJson] = await Promise.all([
      getFileSafe(org, r.name, "package.json", token),
      getFileSafe(org, r.name, "vercel.json", token),
    ]);
    return {
      name: r.name,
      description: r.description,
      homepage: r.homepage,
      language: r.language,
      html_url: r.html_url,
      pushed_at: r.pushed_at,
      package_json: pkg ? JSON.parse(pkg) : null,
      has_vercel_config: !!vercelJson,
    };
  }));

  // Ask Claude to structure these as app entries
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are analyzing GitHub repositories for a client named "${client?.name ?? "unknown"}" to populate their deployed apps list.

Here are their repos:
${JSON.stringify(repoData, null, 2)}

For each repo that represents a deployed application (skip pure libraries, config repos, test repos, etc.), return a JSON array of app objects with these fields:
- name: human-readable app name (not the repo slug)
- status: one of "planning" | "active" | "maintenance" | "deprecated"
- production_url: the production URL if detectable (homepage field, or null)
- staging_url: null unless obvious
- repo_url: the GitHub html_url
- hosting: best guess ("Vercel", "AWS", "Netlify", etc.) based on vercel.json, homepage domain, or package deps
- tech_stack: concise stack description like "Next.js + Supabase" or "React + Vite + Supabase"
- launched_at: ISO date (YYYY-MM-DD) if detectable from pushed_at as a rough proxy, or null
- notes: any brief useful context (1 sentence max), or null

Return ONLY the JSON array, no markdown, no explanation.`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (message.content[0] as { type: string; text: string }).text.trim();

  // Strip markdown code fences if present
  const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  let suggestions: unknown[];
  try {
    suggestions = JSON.parse(json);
  } catch {
    return NextResponse.json({ error: "Claude returned unparseable data", raw: text }, { status: 500 });
  }

  // Save github_org back to client if it was passed in the request
  if (body.github_org && body.github_org !== client?.github_org) {
    await supabase.from("clients").update({ github_org: body.github_org }).eq("id", clientId);
  }

  return NextResponse.json({ suggestions, org });
}
