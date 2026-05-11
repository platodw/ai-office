import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const adminUser = await requireAdmin();
  const { id } = await params;
  const { decision } = await request.json();
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "decision must be approve or reject" }, { status: 400 });
  }

  const admin = createServiceClient();
  const { data: approval, error: loadErr } = await admin
    .from("support_approvals")
    .select("*")
    .eq("id", id)
    .single();
  if (loadErr || !approval) return NextResponse.json({ error: "approval not found" }, { status: 404 });
  if (approval.status !== "pending") return NextResponse.json({ error: `already ${approval.status}` }, { status: 400 });

  if (decision === "reject") {
    await admin.from("support_approvals").update({
      status: "rejected",
      decided_by: adminUser.id,
      decided_at: new Date().toISOString(),
    }).eq("id", id);
    await admin.from("support_messages").insert({
      ticket_id: approval.conversation_id,
      author_type: "system",
      content: `Support team rejected request: ${approval.title}`,
    });
    return NextResponse.json({ message: "rejected" });
  }

  // Approve path — mark approved, then run the handler.
  await admin.from("support_approvals").update({
    status: "approved",
    decided_by: adminUser.id,
    decided_at: new Date().toISOString(),
  }).eq("id", id);

  let executionResult: { ok: boolean; message: string; details?: unknown };
  try {
    executionResult = await runHandler(admin, approval);
  } catch (e) {
    executionResult = { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  await admin.from("support_approvals").update({
    status: executionResult.ok ? "executed" : "failed",
    result: executionResult,
  }).eq("id", id);

  await admin.from("support_messages").insert({
    ticket_id: approval.conversation_id,
    author_type: "system",
    content: executionResult.ok
      ? `Support team approved and ran: ${approval.title} — ${executionResult.message}`
      : `Support team approved but execution failed: ${approval.title} — ${executionResult.message}`,
  });

  return NextResponse.json(executionResult);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runHandler(admin: any, approval: { tool_name: string; client_id: string; payload: Record<string, unknown>; title: string }): Promise<{ ok: boolean; message: string; details?: unknown }> {
  switch (approval.tool_name) {
    case "escalate_to_admin":
      // No execution needed beyond status changes — Dan handles it manually.
      return { ok: true, message: "Marked for manual follow-up" };

    case "create_portal_user": {
      const email = approval.payload.email as string;
      const name  = approval.payload.name as string | null;
      const role  = approval.payload.role as string;
      if (!email) return { ok: false, message: "missing email" };

      const tempPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });
      if (createErr) return { ok: false, message: createErr.message };
      if (name) await admin.from("profiles").update({ name }).eq("id", created.user.id);

      const { error: linkErr } = await admin.from("client_users").insert({
        user_id: created.user.id,
        client_id: approval.client_id,
        portal_role: role,
      });
      if (linkErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        return { ok: false, message: linkErr.message };
      }
      return { ok: true, message: `Created ${email}. Generate a password reset link to send them.`, details: { user_id: created.user.id } };
    }

    default:
      return { ok: false, message: `no handler for ${approval.tool_name}` };
  }
}
