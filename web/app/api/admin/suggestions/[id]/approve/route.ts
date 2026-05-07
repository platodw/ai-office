import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { createClient } from "@/lib/supabase/server";
import { applyEdit } from "@/lib/steps-template-edit";

const OWNER = "platodw";
const REPO = "ai-office";
const FILE_PATH = "web/lib/steps-template.ts";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return NextResponse.json({
      error: "GITHUB_TOKEN not configured. Add a fine-grained PAT with Contents+PRs write access in Vercel env vars.",
    }, { status: 500 });
  }

  const { id } = await params;

  const { data: suggestion, error: fetchErr } = await supabase
    .from("template_suggestions")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr || !suggestion) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }
  if (suggestion.status !== "pending") {
    return NextResponse.json({ error: `Already ${suggestion.status}` }, { status: 400 });
  }

  const octokit = new Octokit({ auth: githubToken });

  try {
    // 1. Fetch current file from main
    const { data: file } = await octokit.repos.getContent({
      owner: OWNER, repo: REPO, path: FILE_PATH, ref: "main",
    });
    if (Array.isArray(file) || file.type !== "file") {
      throw new Error("Unexpected response fetching steps-template.ts");
    }
    const currentSha = file.sha;
    const currentContent = Buffer.from(file.content, "base64").toString("utf-8");

    // 2. Apply the edit in memory
    const newContent = applyEdit(
      currentContent,
      suggestion.step_id,
      suggestion.current_value,
      suggestion.proposed_value,
    );
    if (newContent === currentContent) {
      throw new Error("Edit produced no change — current value may already be applied");
    }

    // 3. Branch off main
    const { data: mainRef } = await octokit.git.getRef({
      owner: OWNER, repo: REPO, ref: "heads/main",
    });
    const branchName = `claude/suggestion-${id.slice(0, 8)}`;
    try {
      await octokit.git.createRef({
        owner: OWNER, repo: REPO,
        ref: `refs/heads/${branchName}`,
        sha: mainRef.object.sha,
      });
    } catch (err: unknown) {
      // If the branch already exists, reuse it.
      if (!(err instanceof Error) || !err.message.toLowerCase().includes("reference already exists")) {
        throw err;
      }
    }

    // 4. Commit the change to the branch
    await octokit.repos.createOrUpdateFileContents({
      owner: OWNER, repo: REPO, path: FILE_PATH,
      branch: branchName,
      message: `Improve "${suggestion.step_id}" instructions based on user friction`,
      content: Buffer.from(newContent, "utf-8").toString("base64"),
      sha: currentSha,
    });

    // 5. Open the PR
    const prBody = `**Triggering question** (anonymous, scrubbed):
> ${suggestion.triggering_question}

**Step:** \`${suggestion.step_id}\`
**Field:** \`${suggestion.field}\`
**Why this helps:** ${suggestion.rationale}

---
Approved from /admin/suggestions in the AI Office dashboard.`;

    const { data: pr } = await octokit.pulls.create({
      owner: OWNER, repo: REPO,
      title: `Improve ${suggestion.step_id} instructions`,
      head: branchName,
      base: "main",
      body: prBody,
    });

    // 6. Mark suggestion approved with PR link
    await supabase
      .from("template_suggestions")
      .update({
        status: "approved",
        pr_url: pr.html_url,
        pr_number: pr.number,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({ ok: true, pr_url: pr.html_url, pr_number: pr.number });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase
      .from("template_suggestions")
      .update({
        status: "failed",
        reviewer_notes: message,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
