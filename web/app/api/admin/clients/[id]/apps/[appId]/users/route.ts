import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, getVaultSecret } from "@/lib/supabase/service";

type Params = { params: Promise<{ id: string; appId: string }> };

export async function GET(_request: Request, { params }: Params) {
  await requireAdmin();
  const { appId } = await params;
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("app_access")
    .select("id, user_id, external_user_id, status, granted_at")
    .eq("app_id", appId)
    .eq("status", "active")
    .order("granted_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json([]);

  // Fetch profiles separately — app_access.user_id FKs to auth.users, not profiles,
  // so PostgREST can't auto-join them.
  const userIds = rows.map(r => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, email")
    .in("id", userIds);

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
  const result = rows.map(r => ({ ...r, profiles: profileMap[r.user_id] ?? null }));

  return NextResponse.json(result);
}

export async function POST(request: Request, { params }: Params) {
  await requireAdmin();
  const { appId } = await params;
  const body = await request.json();
  const { user_id, email: inviteEmail, app_role = "leadership" } = body;

  if (!user_id && !inviteEmail)
    return NextResponse.json({ error: "user_id or email required" }, { status: 400 });

  const admin = createServiceClient();

  const { data: app, error: appErr } = await admin
    .from("client_apps")
    .select("id, name, production_url, supabase_project_ref, supabase_service_key_vault_name")
    .eq("id", appId)
    .single();
  if (appErr || !app) return NextResponse.json({ error: "App not found" }, { status: 404 });

  // Resolve the email and name we'll use in the target project
  let grantUserId: string = user_id;
  let emailForTarget: string = inviteEmail ?? "";
  let nameForTarget = "";

  if (user_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email, name")
      .eq("id", user_id)
      .single();
    if (!profile?.email) return NextResponse.json({ error: "User not found" }, { status: 404 });
    emailForTarget = profile.email;
    nameForTarget = profile.name ?? "";
  } else {
    // Invite-by-email: use the granting admin's id as the app_access user_id
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    grantUserId = user!.id;
  }

  let externalUserId: string | null = null;
  let wasInvited = false;

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

    // Check if user already exists via user_profiles (avoids broken admin API for direct-SQL users)
    const profileLookupRes = await fetch(
      `${baseUrl}/rest/v1/user_profiles?email=eq.${encodeURIComponent(emailForTarget)}&select=id`,
      { headers }
    );
    if (profileLookupRes.ok) {
      const existing = await profileLookupRes.json();
      if (Array.isArray(existing) && existing.length > 0) {
        externalUserId = existing[0].id ?? null;
      }
    }

    if (!externalUserId) {
      if (inviteEmail) {
        // New user path: generate invite link (sends email so they can set their own password).
        // /admin/invite is not available on all GoTrue versions; generate_link is the reliable path.
        const redirectTo = app.production_url ?? undefined;
        const inviteRes = await fetch(`${baseUrl}/auth/v1/admin/generate_link`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            type: "invite",
            email: emailForTarget,
            ...(redirectTo ? { redirect_to: redirectTo } : {}),
            data: { invited_by: "AI Office" },
          }),
        });
        if (inviteRes.ok) {
          const invited = await inviteRes.json();
          externalUserId = invited.id ?? null;
          wasInvited = true;
        } else {
          const err = await inviteRes.json().catch(() => ({})) as Record<string, unknown>;
          const errMsg = (err.msg ?? err.message ?? err.error_description ?? err.error ?? "Invite failed") as string;
          console.error("[invite] Supabase invite error:", JSON.stringify(err));
          return NextResponse.json({ error: errMsg }, { status: 500 });
        }
      } else {
        // Portal user path: create silently (they already have an AI Office account)
        const createRes = await fetch(`${baseUrl}/auth/v1/admin/users`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            email: emailForTarget,
            email_confirm: true,
            user_metadata: { name: nameForTarget },
          }),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          externalUserId = created.id ?? null;
        } else {
          const err = await createRes.json().catch(() => ({})) as Record<string, unknown>;
          const errMsg = (err.msg ?? err.message ?? err.error_description ?? err.error ?? "Failed to create user in target app") as string;
          console.error("[invite] Supabase create user error:", JSON.stringify(err));
          return NextResponse.json({ error: errMsg }, { status: 500 });
        }
      }
    }

    // Upsert role in target user_profiles
    if (externalUserId) {
      await fetch(`${baseUrl}/rest/v1/user_profiles`, {
        method: "POST",
        headers: { ...headers, "Prefer": "resolution=merge-duplicates" },
        body: JSON.stringify({
          id: externalUserId,
          email: emailForTarget,
          name: nameForTarget,
          role: app_role,
        }),
      });
    }
  }

  const { data: access, error: insertErr } = await admin
    .from("app_access")
    .upsert(
      { app_id: appId, user_id: grantUserId, external_user_id: externalUserId, status: "active", revoked_at: null },
      { onConflict: "app_id,user_id" }
    )
    .select()
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ ...access, email: emailForTarget, invited: wasInvited });
}
