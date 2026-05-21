-- Credential vault: metadata for API keys/secrets stored in Supabase Vault.
-- The actual secret value is never stored in this table.

create table credential_vault (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid references clients on delete set null,
  label             text not null,              -- "OpenAI Production Key"
  service           text not null,              -- "OpenAI", "Stripe", etc.
  vault_secret_name text not null unique,       -- key in vault.secrets
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table credential_vault enable row level security;
create policy "credential_vault_admin_all" on credential_vault for all using (is_admin());

create trigger credential_vault_updated_at
  before update on credential_vault
  for each row execute function set_updated_at();

-- Read helper called by service.ts (create or replace so it's safe to re-run)
create or replace function admin_get_vault_secret(p_name text)
returns text
language plpgsql security definer
as $$
begin
  return (
    select decrypted_secret
    from vault.decrypted_secrets
    where name = p_name
    limit 1
  );
end;
$$;
