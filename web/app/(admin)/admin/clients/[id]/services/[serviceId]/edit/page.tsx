import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import EditServiceForm from "./EditServiceForm";

export default async function EditServicePage({ params }: { params: Promise<{ id: string; serviceId: string }> }) {
  const { id: clientId, serviceId } = await params;
  const supabase = await createClient();

  const { data: service } = await supabase
    .from("client_services")
    .select("*")
    .eq("id", serviceId)
    .eq("client_id", clientId)
    .single();

  if (!service) notFound();

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <a href={`/admin/clients/${clientId}`} className="text-xs text-muted hover:text-text transition-colors">
          ← Back to client
        </a>
        <h1 className="text-2xl font-bold text-text mt-3 mb-1">Edit service</h1>
        <p className="text-sm text-muted">Update the details for this service.</p>
      </div>
      <EditServiceForm clientId={clientId} service={service} />
    </div>
  );
}
