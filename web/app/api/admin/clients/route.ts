// POST /api/admin/clients — create a new client (admin only).
// Accepts multipart/form-data so the logo file can be uploaded in the same request.

import { NextRequest, NextResponse } from "next/server";
import { createClient }        from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(req: NextRequest) {
  // Auth — admin only.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let form: FormData;
  try { form = await req.formData(); } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const name       = (form.get("name") as string)?.trim();
  const status     = (form.get("status") as string) || "onboarding";
  const website    = (form.get("website") as string)?.trim() || null;
  const industry   = (form.get("industry") as string)?.trim() || null;
  const notes      = (form.get("notes") as string)?.trim() || null;
  const brandColor = (form.get("brand_color") as string)?.trim() || null;
  const logoFile   = form.get("logo") as File | null;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 422 });

  const svc = createServiceClient();

  // Upload logo if provided.
  let logoUrl: string | null = null;
  if (logoFile && logoFile.size > 0) {
    const ext  = logoFile.name.split(".").pop() ?? "png";
    const path = `${Date.now()}-${name.toLowerCase().replace(/\s+/g, "-")}.${ext}`;

    const bytes = await logoFile.arrayBuffer();
    const { data: upload, error: uploadErr } = await svc.storage
      .from("client-logos")
      .upload(path, bytes, { contentType: logoFile.type, upsert: false });

    if (!uploadErr && upload) {
      const { data: urlData } = svc.storage.from("client-logos").getPublicUrl(upload.path);
      logoUrl = urlData.publicUrl;
    }
  }

  // Create client record.
  // Try full insert first (requires migration 006). If columns don't exist yet,
  // fall back to the base columns so the client is still created.
  let client: { id: string } | null = null;

  const fullInsert = await svc
    .from("clients")
    .insert({ name, status, website, industry, notes, brand_color: brandColor, logo_url: logoUrl })
    .select("id")
    .single();

  if (fullInsert.error) {
    console.error("[clients] full insert error:", fullInsert.error.message);

    const isMissingColumn = fullInsert.error.message.includes("column") ||
      fullInsert.error.code === "42703";

    if (isMissingColumn) {
      // Migration 006 not yet applied — insert without branding columns.
      const fallback = await svc
        .from("clients")
        .insert({ name, status, notes })
        .select("id")
        .single();

      if (fallback.error || !fallback.data) {
        return NextResponse.json(
          { error: `Failed to create client: ${fallback.error?.message ?? "unknown"}` },
          { status: 500 }
        );
      }
      client = fallback.data;
    } else {
      return NextResponse.json(
        { error: `Failed to create client: ${fullInsert.error.message}` },
        { status: 500 }
      );
    }
  } else {
    client = fullInsert.data;
  }

  // Create primary contact if provided.
  const contactName  = (form.get("contact_name") as string)?.trim();
  const contactEmail = (form.get("contact_email") as string)?.trim() || null;
  const contactPhone = (form.get("contact_phone") as string)?.trim() || null;
  const contactRole  = (form.get("contact_role") as string)?.trim() || null;

  if (contactName) {
    await svc.from("client_contacts").insert({
      client_id:  client.id,
      name:       contactName,
      email:      contactEmail,
      phone:      contactPhone,
      role:       contactRole,
      is_primary: true,
    });
  }

  return NextResponse.json({ clientId: client.id }, { status: 201 });
}
