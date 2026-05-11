import type { SupabaseClient } from "@supabase/supabase-js";

// All tools are scoped to the calling user's client_id, which is passed in by
// the runtime — the model can't change it via input. Each tool returns plain
// data the agent can summarize in its reply.

export const listAppsTool = {
  name: "list_apps",
  description:
    "List the client's deployed apps: production/staging URLs, hosting, tech stack, status, and launch dates. Use this when the user asks 'what apps do I have', 'what's deployed', 'show my apps', or similar.",
  input_schema: { type: "object", properties: {}, required: [] },
} as const;

export async function runListApps(supabase: SupabaseClient, clientId: string) {
  const { data, error } = await supabase
    .from("client_apps")
    .select("id, name, notes, status, production_url, staging_url, repo_url, hosting, tech_stack, launched_at")
    .eq("client_id", clientId)
    .order("launched_at", { ascending: false, nullsFirst: false });
  if (error) return { error: error.message, apps: [] };
  return { apps: data ?? [] };
}

export const listContactsTool = {
  name: "list_contacts",
  description:
    "List the people on file for this client: name, role, email, phone, who's the primary contact. Use when the user asks who else has access, who the primary contact is, or wants contact info.",
  input_schema: { type: "object", properties: {}, required: [] },
} as const;

export async function runListContacts(supabase: SupabaseClient, clientId: string) {
  const { data, error } = await supabase
    .from("client_contacts")
    .select("name, role, email, phone, is_primary")
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false });
  if (error) return { error: error.message, contacts: [] };
  return { contacts: data ?? [] };
}

export const listServicesTool = {
  name: "list_services",
  description:
    "List the client's services (active monthly retainers and one-time projects): name, type, amount, billing window, status. Use when the user asks about what they're paying for, their plan, or active engagements.",
  input_schema: { type: "object", properties: {}, required: [] },
} as const;

export async function runListServices(supabase: SupabaseClient, clientId: string) {
  const { data, error } = await supabase
    .from("client_services")
    .select("name, type, amount_cents, billing_start, billing_end, status")
    .eq("client_id", clientId)
    .order("billing_start", { ascending: false });
  if (error) return { error: error.message, services: [] };
  return {
    services: (data ?? []).map((s) => ({
      name: s.name,
      type: s.type,
      amount_usd: (s.amount_cents / 100).toFixed(2),
      billing_start: s.billing_start,
      billing_end: s.billing_end,
      status: s.status,
    })),
  };
}

export const recentInvoicesTool = {
  name: "recent_invoices",
  description:
    "Recent invoices for this client (last 10): number, total, status, due date. Use when the user asks about billing, payment status, or what they've been invoiced.",
  input_schema: { type: "object", properties: {}, required: [] },
} as const;

export async function runRecentInvoices(supabase: SupabaseClient, clientId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("invoice_number, status, total_cents, issued_date, due_date")
    .eq("client_id", clientId)
    .order("issued_date", { ascending: false })
    .limit(10);
  if (error) return { error: error.message, invoices: [] };
  return {
    invoices: (data ?? []).map((i) => ({
      invoice_number: i.invoice_number,
      status: i.status,
      total_usd: (i.total_cents / 100).toFixed(2),
      issued: i.issued_date,
      due: i.due_date,
    })),
  };
}

export const accountOverviewTool = {
  name: "account_overview",
  description:
    "High-level snapshot of the client account: name, current status, primary contact, count of apps + active services. Use this first when the user asks a broad 'how am I doing' or 'what's the status' question.",
  input_schema: { type: "object", properties: {}, required: [] },
} as const;

export async function runAccountOverview(supabase: SupabaseClient, clientId: string) {
  const [{ data: client }, { count: appCount }, { count: serviceCount }, { data: primary }] = await Promise.all([
    supabase.from("clients").select("name, status, onboarded_at, website").eq("id", clientId).single(),
    supabase.from("client_apps").select("id", { count: "exact", head: true }).eq("client_id", clientId),
    supabase.from("client_services").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "active"),
    supabase.from("client_contacts").select("name, role, email").eq("client_id", clientId).eq("is_primary", true).maybeSingle(),
  ]);
  return {
    name: client?.name,
    status: client?.status,
    website: client?.website,
    onboarded_at: client?.onboarded_at,
    primary_contact: primary ?? null,
    app_count: appCount ?? 0,
    active_service_count: serviceCount ?? 0,
  };
}
