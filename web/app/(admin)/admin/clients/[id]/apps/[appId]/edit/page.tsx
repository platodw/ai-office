import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import AppForm from "../../AppForm";

export default async function EditAppPage({ params }: { params: Promise<{ id: string; appId: string }> }) {
  const { id, appId } = await params;
  const supabase = await createClient();
  const { data: app } = await supabase.from("client_apps").select("*").eq("id", appId).single();
  if (!app) notFound();

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link href="/admin/clients" className="text-muted hover:text-text">Clients</Link>
        <span className="text-muted">/</span>
        <Link href={`/admin/clients/${id}`} className="text-muted hover:text-text">Client</Link>
        <span className="text-muted">/</span>
        <span className="text-text">Edit app</span>
      </div>
      <h1 className="text-xl font-bold text-text mb-6">Edit {app.name}</h1>
      <AppForm clientId={id} initial={{ ...app, launched_at: app.launched_at ?? "" }} />
    </div>
  );
}
