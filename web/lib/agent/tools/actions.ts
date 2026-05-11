import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyDanNewApproval } from "@/lib/support/notify";

async function pingTelegram(supabase: SupabaseClient, clientId: string, kind: "action" | "code_change", toolName: string, title: string, description: string | null) {
  const { data: client } = await supabase.from("clients").select("name").eq("id", clientId).single();
  return notifyDanNewApproval({
    clientName: client?.name ?? "Unknown",
    kind,
    toolName,
    title,
    description,
  });
}

// Action tools never execute directly. They write a row to support_approvals
// with status='pending' and return a message telling the agent that the
// Support team has been notified. A separate admin flow approves and runs
// the handler. This keeps every state-changing action gated.

export const escalateToAdminTool = {
  name: "escalate_to_admin",
  description:
    "Flag this conversation for the Support team to review. Use when the user has an issue you can't resolve, a complaint, or asks to talk to a human. Provide a short summary so Dan can pick it up without re-reading the chat.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short title for the issue (under 80 chars)" },
      description: { type: "string", description: "What the user wants and any relevant context" },
    },
    required: ["title", "description"],
  },
} as const;

export const proposeCreatePortalUserTool = {
  name: "propose_create_portal_user",
  description:
    "Propose adding a new portal user to this client account. Use when the user asks to add a teammate, give someone access to the portal, or invite a coworker. Does NOT create the user — it submits the request for Support team approval.",
  input_schema: {
    type: "object",
    properties: {
      email: { type: "string", description: "Email address for the new portal user" },
      name:  { type: "string", description: "Full name (optional but encouraged)" },
      role:  { type: "string", enum: ["power_user", "billing", "viewer"], description: "Portal role" },
    },
    required: ["email", "role"],
  },
} as const;

export type ApprovalContext = {
  supabase: SupabaseClient;
  clientId: string;
  conversationId: string;
};

export async function runEscalateToAdmin(
  ctx: ApprovalContext,
  input: { title: string; description: string },
) {
  const { data: inserted, error } = await ctx.supabase.from("support_approvals").insert({
    conversation_id: ctx.conversationId,
    client_id:       ctx.clientId,
    kind:            "action",
    tool_name:       "escalate_to_admin",
    title:           input.title,
    description:     input.description,
    payload:         {},
  }).select("id").single();
  if (error || !inserted) return { ok: false, error: error?.message ?? "insert failed" };
  await ctx.supabase
    .from("support_tickets")
    .update({ status: "waiting_on_dan", kind: "ticket", title: input.title })
    .eq("id", ctx.conversationId);
  const tgResult = await pingTelegram(ctx.supabase, ctx.clientId, "action", "escalate_to_admin", input.title, input.description);
  // Stash the telegram diagnosis on the approval row so we can debug via DB.
  await ctx.supabase.from("support_approvals").update({ result: { telegram: tgResult } }).eq("id", inserted.id);
  return { ok: true, status: "pending", message: "Flagged for the Support team. They'll review and follow up." };
}

export async function runProposeCreatePortalUser(
  ctx: ApprovalContext,
  input: { email: string; name?: string; role: "power_user" | "billing" | "viewer" },
) {
  if (!input.email || !input.email.includes("@")) {
    return { ok: false, error: "invalid email" };
  }
  const title = `Add portal user ${input.email}`;
  const { data: inserted, error } = await ctx.supabase.from("support_approvals").insert({
    conversation_id: ctx.conversationId,
    client_id:       ctx.clientId,
    kind:            "action",
    tool_name:       "create_portal_user",
    title,
    description:     `Add ${input.name ?? input.email} as a ${input.role}.`,
    payload:         { email: input.email, name: input.name ?? null, role: input.role },
  }).select("id").single();
  if (error || !inserted) return { ok: false, error: error?.message ?? "insert failed" };
  await ctx.supabase
    .from("support_tickets")
    .update({ status: "awaiting_approval", kind: "ticket", title })
    .eq("id", ctx.conversationId);
  const tgResult = await pingTelegram(ctx.supabase, ctx.clientId, "action", "create_portal_user", title, `Role: ${input.role}`);
  await ctx.supabase.from("support_approvals").update({ result: { telegram: tgResult } }).eq("id", inserted.id);
  return { ok: true, status: "pending", message: `Submitted ${input.email} for approval.` };
}

export const ACTION_TOOLS = [escalateToAdminTool, proposeCreatePortalUserTool];
