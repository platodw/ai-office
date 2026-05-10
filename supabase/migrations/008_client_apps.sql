create table client_apps (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid references clients on delete cascade not null,
  name           text not null,
  status         text not null default 'active'
                   check (status in ('planning', 'active', 'maintenance', 'deprecated')),
  production_url text,
  staging_url    text,
  repo_url       text,
  hosting        text,
  tech_stack     text,
  launched_at    date,
  notes          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index client_apps_client_id_idx on client_apps(client_id);

alter table client_apps enable row level security;

create policy "apps_admin_all" on client_apps for all using (is_admin());
create policy "apps_portal_read" on client_apps for select using (client_id = my_client_id());

create trigger client_apps_updated_at
  before update on client_apps
  for each row execute function set_updated_at();
