import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/steps/:id — mark a step complete/skipped (from extension via token, or from web app)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const body = await request.json();
  const status = body.status as string;

  if (!["complete", "skipped", "in_progress", "pending"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  let supabase;

  if (token) {
    // Extension auth: validate token, use service client
    const svc = createServiceClient();
    const { data: tokenRow } = await svc
      .from("extension_tokens")
      .select("user_id")
      .eq("token", token)
      .single();
    if (!tokenRow) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    supabase = svc;
  } else {
    // Web app auth: use session
    supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update: Record<string, unknown> = { status };
  if (status === "complete") update.completed_at = new Date().toISOString();
  if (status === "pending") update.completed_at = null;

  const { error } = await supabase
    .from("setup_steps")
    .update(update)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
