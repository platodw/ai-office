-- AI Office — Client management schema
-- Tracks clients, their contacts, technical details, and API configurations.
-- Admin detection reuses the is_admin flag added in migration 002.

-- ── Helper ────────────────────────────────────────────────────────────────────

create or replace function is_admin()
returns boolean
language sql security definer stable
as $$
  select coalesce(
    (select is_admin from profiles where id = auth.uid()),
    false
  );
$$;

-- ── Clients ───────────────────────────────────────────────────────────────────

create table clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  status      text not null default 'onboarding'
                check (status in ('onboarding', 'active', 'offboarding', 'churned')),
  onboarded_at timestamptz,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── Client contacts ───────────────────────────────────────────────────────────

create table client_contacts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients on delete cascade not null,
  name        text not null,
  email       text,
  phone       text,
  role        text,          -- "Power User", "Billing Contact", "Executive Sponsor", etc.
  is_primary  boolean default false,
  created_at  timestamptz default now()
);

create index client_contacts_client_id_idx on client_contacts(client_id);

-- ── Client ↔ auth users ───────────────────────────────────────────────────────
-- Links a Supabase auth user to a client account with a portal role.

create table client_users (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade not null,
  client_id   uuid references clients on delete cascade not null,
  portal_role text not null default 'power_user'
                check (portal_role in ('power_user', 'billing', 'viewer')),
  created_at  timestamptz default now(),
  unique(user_id, client_id)
);

create index client_users_user_id_idx   on client_users(user_id);
create index client_users_client_id_idx on client_users(client_id);

-- ── Technical information ─────────────────────────────────────────────────────

create table client_tech_info (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid references clients on delete cascade not null unique,
  domain_registrar    text,
  dns_provider        text,
  hosting_provider    text,
  it_service_provider text,
  notes               text,    -- freeform markdown
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── API configurations ────────────────────────────────────────────────────────
-- Stores which external API accounts belong to each client.
-- Credentials are never stored in plaintext — use vault_secret_name to reference
-- a Supabase Vault secret. The actual secret value is only accessed server-side
-- via the service role and never returned to the browser.

create table client_api_configs (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid references clients on delete cascade not null,
  provider          text not null
                      check (provider in ('anthropic', 'vercel', 'supabase', 'other')),
  display_name      text not null,    -- "Anthropic Production Org"
  external_id       text not null,    -- org ID / team ID / project ID used in billing API calls
  vault_secret_name text,             -- Supabase Vault secret key (never the secret itself)
  is_active         boolean default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique(client_id, provider, external_id)
);

create index client_api_configs_client_id_idx on client_api_configs(client_id);

-- ── Audit log ─────────────────────────────────────────────────────────────────
-- Append-only. Written server-side only (service role). No direct client writes.

create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users,
  action        text not null,          -- 'read_api_config', 'update_client', etc.
  resource_type text not null,
  resource_id   uuid,
  client_id     uuid references clients,
  metadata      jsonb default '{}'::jsonb,
  ip_address    inet,
  created_at    timestamptz default now()
);

create index audit_log_client_id_idx  on audit_log(client_id);
create index audit_log_user_id_idx    on audit_log(user_id);
create index audit_log_created_at_idx on audit_log(created_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table clients             enable row level security;
alter table client_contacts     enable row level security;
alter table client_users        enable row level security;
alter table client_tech_info    enable row level security;
alter table client_api_configs  enable row level security;
alter table audit_log           enable row level security;

-- Helper: returns the client_id for the current auth user (null if none).
create or replace function my_client_id()
returns uuid
language sql security definer stable
as $$
  select client_id from client_users where user_id = auth.uid() limit 1;
$$;

-- clients: admin full access; portal users can read their own client row.
create policy "clients_admin_all"   on clients for all using (is_admin());
create policy "clients_portal_read" on clients for select
  using (id = my_client_id());

-- client_contacts: admin full; portal users read their client's contacts.
create policy "contacts_admin_all"   on client_contacts for all using (is_admin());
create policy "contacts_portal_read" on client_contacts for select
  using (client_id = my_client_id());

-- client_users: admin full; users can read their own row only.
create policy "client_users_admin_all" on client_users for all using (is_admin());
create policy "client_users_self_read" on client_users for select
  using (user_id = auth.uid());

-- client_tech_info: admin full; portal users read (not write) their own.
create policy "tech_info_admin_all"   on client_tech_info for all using (is_admin());
create policy "tech_info_portal_read" on client_tech_info for select
  using (client_id = my_client_id());

-- client_api_configs: admin only — credentials are sensitive.
create policy "api_configs_admin_all" on client_api_configs for all using (is_admin());

-- audit_log: admin read-only; no direct writes from browser (service role only).
create policy "audit_log_admin_read" on audit_log for select using (is_admin());

-- ── Updated_at trigger ────────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_updated_at
  before update on clients
  for each row execute function set_updated_at();

create trigger client_tech_info_updated_at
  before update on client_tech_info
  for each row execute function set_updated_at();

create trigger client_api_configs_updated_at
  before update on client_api_configs
  for each row execute function set_updated_at();
