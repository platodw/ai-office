import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  await requireAdmin();
  const { id: clientId } = await params;
  const admin = createServiceClient();

  const { data, error } = await admin
    .from("kb_articles")
    .select("id, title, category, tags, source, is_published, created_at, updated_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request, { params }: Params) {
  await requireAdmin();
  const { id: clientId } = await params;
  const body = await req.json();
  const { title, content, category, tags, is_published } = body;

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("kb_articles")
    .insert({
      client_id: clientId,
      title: title.trim(),
      content: content.trim(),
      category: category || null,
      tags: tags ?? [],
      is_published: is_published ?? true,
      source: "manual",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
