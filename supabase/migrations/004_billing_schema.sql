-- AI Office — Billing schema
-- Billing snapshots pulled from provider APIs, invoices, line items, and Stripe integration.

-- ── Billing snapshots ─────────────────────────────────────────────────────────
-- One row per provider per billing period per client.
-- Populated by a cron job that hits Anthropic / Vercel / Supabase APIs.

create table billing_snapshots (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid references clients on delete cascade not null,
  api_config_id  uuid references client_api_configs on delete set null,
  provider       text not null
                   check (provider in ('anthropic', 'vercel', 'supabase', 'other')),
  period_start   date not null,
  period_end     date not null,
  amount_cents   bigint not null default 0,
  currency       text not null default 'usd',
  raw_data       jsonb default '{}'::jsonb,   -- full provider API response
  pulled_at      timestamptz default now(),
  unique(api_config_id, period_start, period_end)
);

create index billing_snapshots_client_id_idx  on billing_snapshots(client_id);
create index billing_snapshots_period_idx     on billing_snapshots(period_start, period_end);

-- ── Invoices ──────────────────────────────────────────────────────────────────

create table invoices (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid references clients on delete cascade not null,
  invoice_number      text unique not null,
  status              text not null default 'draft'
                        check (status in ('draft', 'sent', 'paid', 'overdue', 'void')),
  issued_date         date not null,
  due_date            date not null,
  subtotal_cents      bigint not null default 0,
  tax_cents           bigint not null default 0,
  total_cents         bigint not null default 0,
  stripe_invoice_id   text unique,
  stripe_payment_url  text,
  paid_at             timestamptz,
  notes               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index invoices_client_id_idx on invoices(client_id);
create index invoices_status_idx    on invoices(status);

-- ── Invoice line items ────────────────────────────────────────────────────────

create table invoice_line_items (
  id                   uuid primary key default gen_random_uuid(),
  invoice_id           uuid references invoices on delete cascade not null,
  description          text not null,
  quantity             numeric not null default 1,
  unit_price_cents     bigint not null,
  total_cents          bigint not null,
  category             text check (category in ('service', 'infrastructure', 'project', 'other')),
  billing_snapshot_id  uuid references billing_snapshots on delete set null,
  sort_order           int default 0
);

create index invoice_line_items_invoice_id_idx on invoice_line_items(invoice_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table billing_snapshots  enable row level security;
alter table invoices            enable row level security;
alter table invoice_line_items  enable row level security;

-- billing_snapshots: admin full; portal users read their own client's snapshots.
create policy "snapshots_admin_all"   on billing_snapshots for all using (is_admin());
create policy "snapshots_portal_read" on billing_snapshots for select
  using (client_id = my_client_id());

-- invoices: admin full; portal users read their own client's invoices.
create policy "invoices_admin_all"   on invoices for all using (is_admin());
create policy "invoices_portal_read" on invoices for select
  using (client_id = my_client_id());

-- invoice_line_items: admin full; portal users read items for their invoices.
create policy "line_items_admin_all"   on invoice_line_items for all using (is_admin());
create policy "line_items_portal_read" on invoice_line_items for select
  using (
    invoice_id in (
      select id from invoices where client_id = my_client_id()
    )
  );

-- ── Updated_at trigger ────────────────────────────────────────────────────────

create trigger invoices_updated_at
  before update on invoices
  for each row execute function set_updated_at();

-- ── Invoice number sequence ───────────────────────────────────────────────────
-- Generates invoice numbers like INV-2026-0001.

create sequence invoice_number_seq start 1;

create or replace function next_invoice_number()
returns text
language plpgsql
as $$
begin
  return 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text, 4, '0');
end;
$$;
