import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient, getVaultSecret } from "@/lib/supabase/service";

type Params = { params: Promise<{ id: string; appId: string; accessId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  await requireAdmin();
  const { appId, accessId } = await params;
  const admin = createServiceClient();

  const [{ data: access }, { data: app }] = await Promise.all([
    admin.from("app_access").select("user_id, external_user_id").eq("id", accessId).single(),
    admin.from("client_apps").select("supabase_project_ref, supabase_service_key_vault_name").eq("id", appId).single(),
  ]);

  // Ban user in target Supabase project (disable without deleting)
  if (access?.external_user_id && app?.supabase_project_ref && app?.supabase_service_key_vault_name) {
    const serviceKey = await getVaultSecret(app.supabase_service_key_vault_name);
    if (serviceKey) {
      await fetch(
        `https://${app.supabase_project_ref}.supabase.co/auth/v1/admin/users/${access.external_user_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
          },
          body: JSON.stringify({ ban_duration: "876600h" }),
        }
      );
    }
  }

  const { error } = await admin
    .from("app_access")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", accessId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
