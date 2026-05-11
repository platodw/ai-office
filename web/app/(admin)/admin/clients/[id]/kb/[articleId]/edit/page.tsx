import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notFound } from "next/navigation";
import Link from "next/link";
import ArticleForm from "../../ArticleForm";

export default async function EditKbArticlePage({
  params,
}: {
  params: Promise<{ id: string; articleId: string }>;
}) {
  await requireAdmin();
  const { id, articleId } = await params;
  const supabase = await createClient();
  const admin = createServiceClient();

  const [{ data: client }, { data: article }] = await Promise.all([
    supabase.from("clients").select("name").eq("id", id).single(),
    admin.from("kb_articles").select("title, content, category, tags, is_published").eq("id", articleId).single(),
  ]);

  if (!client || !article) notFound();

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link href="/admin/clients" className="hover:text-text transition-colors">Clients</Link>
        <span>/</span>
        <Link href={`/admin/clients/${id}`} className="hover:text-text transition-colors">{client.name}</Link>
        <span>/</span>
        <span className="text-text">Edit KB article</span>
      </div>
      <h1 className="text-xl font-bold text-text mb-6">Edit knowledge base article</h1>
      <ArticleForm
        clientId={id}
        articleId={articleId}
        initial={{
          title: article.title,
          content: article.content,
          category: article.category,
          tags: article.tags ?? [],
          is_published: article.is_published ?? true,
        }}
      />
    </div>
  );
}
