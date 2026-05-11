import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import ArticleForm from "../ArticleForm";

export default async function NewKbArticlePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("name").eq("id", id).single();
  if (!client) notFound();

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link href="/admin/clients" className="hover:text-text transition-colors">Clients</Link>
        <span>/</span>
        <Link href={`/admin/clients/${id}`} className="hover:text-text transition-colors">{client.name}</Link>
        <span>/</span>
        <span className="text-text">New KB article</span>
      </div>
      <h1 className="text-xl font-bold text-text mb-6">New knowledge base article</h1>
      <ArticleForm clientId={id} />
    </div>
  );
}
