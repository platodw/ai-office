import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    client_id: string;
    issued_date: string;
    due_date: string;
    notes?: string;
    line_items: {
      description: string;
      quantity: number;
      unit_price_cents: number;
      total_cents: number;
      category: string;
      billing_snapshot_id?: string;
      client_service_id?: string;
      sort_order?: number;
    }[];
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { client_id, issued_date, due_date, notes, line_items } = body;
  if (!client_id || !issued_date || !due_date || !line_items?.length) {
    return NextResponse.json({ error: "client_id, issued_date, due_date, and line_items are required" }, { status: 422 });
  }

  const subtotal = line_items.reduce((s, li) => s + li.total_cents, 0);

  // Generate sequential invoice number: INV-YYYYMM-NNN
  const prefix = `INV-${issued_date.slice(0, 7).replace("-", "")}-`;
  const { data: existing } = await supabase
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1)
    .single();

  let seq = 1;
  if (existing?.invoice_number) {
    const parts = existing.invoice_number.split("-");
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }
  const invoiceNumber = `${prefix}${String(seq).padStart(3, "0")}`;

  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .insert({ client_id, invoice_number: invoiceNumber, issued_date, due_date, subtotal_cents: subtotal, total_cents: subtotal, notes: notes || null })
    .select("id")
    .single();

  if (invError) return NextResponse.json({ error: invError.message }, { status: 500 });

  const rows = line_items.map((li, i) => ({
    invoice_id: invoice.id,
    description: li.description,
    quantity: li.quantity,
    unit_price_cents: li.unit_price_cents,
    total_cents: li.total_cents,
    category: li.category,
    billing_snapshot_id: li.billing_snapshot_id ?? null,
    client_service_id: li.client_service_id ?? null,
    sort_order: li.sort_order ?? i,
  }));

  const { error: liError } = await supabase.from("invoice_line_items").insert(rows);
  if (liError) {
    // Roll back the invoice header
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return NextResponse.json({ error: liError.message }, { status: 500 });
  }

  // Mark any one_time services as invoiced if they appear on this invoice
  const serviceIds = line_items
    .filter(li => li.client_service_id)
    .map(li => li.client_service_id!);
  if (serviceIds.length) {
    await supabase
      .from("client_services")
      .update({ invoiced_at: new Date().toISOString() })
      .in("id", serviceIds)
      .eq("type", "one_time")
      .is("invoiced_at", null);
  }

  return NextResponse.json({ invoiceId: invoice.id, invoiceNumber }, { status: 201 });
}
