import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

type Params = { params: Promise<{ id: string; articleId: string }> };

export async function GET(_req: Request, { params }: Params) {
  await requireAdmin();
  const { articleId } = await params;
  const admin = createServiceClient();

  const { data, error } = await admin
    .from("kb_articles")
    .select("*")
    .eq("id", articleId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request, { params }: Params) {
  await requireAdmin();
  const { articleId } = await params;
  const body = await req.json();
  const { title, content, category, tags, is_published } = body;

  const admin = createServiceClient();
  const { error } = await admin
    .from("kb_articles")
    .update({
      ...(title !== undefined && { title: title.trim() }),
      ...(content !== undefined && { content: content.trim() }),
      ...(category !== undefined && { category: category || null }),
      ...(tags !== undefined && { tags }),
      ...(is_published !== undefined && { is_published }),
    })
    .eq("id", articleId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  await requireAdmin();
  const { articleId } = await params;
  const admin = createServiceClient();

  const { error } = await admin.from("kb_articles").delete().eq("id", articleId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
