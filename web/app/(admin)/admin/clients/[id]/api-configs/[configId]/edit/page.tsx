import { createClient } from "@/lib/supabase/server";
import { notFound }     from "next/navigation";
import EditApiConfigForm from "./EditApiConfigForm";

export default async function EditApiConfigPage({
  params,
}: {
  params: Promise<{ id: string; configId: string }>;
}) {
  const { id: clientId, configId } = await params;
  const supabase = await createClient();

  const { data: config } = await supabase
    .from("client_api_configs")
    .select("id, provider, display_name, external_id, is_active")
    .eq("id", configId)
    .eq("client_id", clientId)
    .single();

  if (!config) notFound();

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <a href={`/admin/clients/${clientId}`} className="text-xs text-muted hover:text-text transition-colors">
          ← Back to client
        </a>
        <h1 className="text-2xl font-bold text-text mt-3 mb-1">Edit API configuration</h1>
        <p className="text-sm text-muted">Update credentials or settings for this integration.</p>
      </div>
      <EditApiConfigForm clientId={clientId} config={config} />
    </div>
  );
}
