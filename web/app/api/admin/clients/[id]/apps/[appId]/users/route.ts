import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, getVaultSecret } from "@/lib/supabase/service";

type Params = { params: Promise<{ id: string; appId: string }> };

export async function GET(_request: Request, { params }: Params) {
  await requireAdmin();
  const { appId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("app_access")
    .select("id, user_id, external_user_id, status, granted_at, profiles(name, email)")
    .eq("app_id", appId)
    .eq("status", "active")
    .order("granted_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request, { params }: Params) {
  await requireAdmin();
  const { appId } = await params;
  const { user_id, app_role = "leadership" } = await request.json();
  if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const admin = createServiceClient();

  const { data: app, error: appErr } = await admin
    .from("client_apps")
    .select("id, name, supabase_project_ref, supabase_service_key_vault_name")
    .eq("id", appId)
    .single();
  if (appErr || !app) return NextResponse.json({ error: "App not found" }, { status: 404 });

  const { data: profile } = await admin
    .from("profiles")
    .select("email, name")
    .eq("id", user_id)
    .single();
  if (!profile?.email) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let externalUserId: string | null = null;

  if (app.supabase_project_ref && app.supabase_service_key_vault_name) {
    const serviceKey = await getVaultSecret(app.supabase_service_key_vault_name);
    if (!serviceKey) {
      return NextResponse.json(
        { error: `Service key "${app.supabase_service_key_vault_name}" not found in vault.` },
        { status: 500 }
      );
    }

    const baseUrl = `https://${app.supabase_project_ref}.supabase.co`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
      "apikey": serviceKey,
    };

    // Step 1: Check if user already exists in the target app's user_profiles table.
    // This avoids the auth admin API entirely for users created via direct SQL,
    // which can have a broken auth.identities state that crashes the admin API.
    const profileLookupRes = await fetch(
      `${baseUrl}/rest/v1/user_profiles?email=eq.${encodeURIComponent(profile.email)}&select=id`,
      { headers }
    );
    if (profileLookupRes.ok) {
      const rows = await profileLookupRes.json();
      if (Array.isArray(rows) && rows.length > 0) {
        externalUserId = rows[0].id ?? null;
      }
    }

    // Step 2: If not found in user_profiles, create via admin API (new user).
    if (!externalUserId) {
      const createRes = await fetch(`${baseUrl}/auth/v1/admin/users`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: profile.email,
          email_confirm: true,
          user_metadata: { name: profile.name ?? "" },
        }),
      });

      if (createRes.ok) {
        const created = await createRes.json();
        externalUserId = created.id ?? null;
      } else {
        const err = await createRes.json().catch(() => ({}));
        return NextResponse.json(
          { error: (err as { msg?: string }).msg ?? "Failed to create user in target app" },
          { status: 500 }
        );
      }
    }

    // Step 3: Upsert role in target user_profiles.
    if (externalUserId) {
      await fetch(`${baseUrl}/rest/v1/user_profiles`, {
        method: "POST",
        headers: { ...headers, "Prefer": "resolution=merge-duplicates" },
        body: JSON.stringify({
          id: externalUserId,
          email: profile.email,
          name: profile.name ?? "",
          role: app_role,
        }),
      });
    }
  }

  const { data: access, error: insertErr } = await admin
    .from("app_access")
    .upsert(
      { app_id: appId, user_id, external_user_id: externalUserId, status: "active", revoked_at: null },
      { onConflict: "app_id,user_id" }
    )
    .select()
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ ...access, email: profile.email });
}
