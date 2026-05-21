import { createServiceClient } from "@/lib/supabase/service";
import VaultClient from "./VaultClient";

export default async function VaultPage() {
  const svc = createServiceClient();
  const [{ data: entries }, { data: clients }] = await Promise.all([
    svc
      .from("credential_vault")
      .select("id, client_id, label, service, notes, created_at, clients(id, name)")
      .order("created_at", { ascending: false }),
    svc
      .from("clients")
      .select("id, name")
      .eq("status", "active")
      .order("name"),
  ]);

  return <VaultClient initialEntries={entries ?? []} clients={clients ?? []} />;
}
