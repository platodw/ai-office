-- Vault helper functions callable via RPC with service role.
-- The JS client cannot call vault.create_secret directly, so we wrap it.

create or replace function admin_store_vault_secret(p_name text, p_secret text)
returns uuid
language plpgsql security definer
as $$
declare
  v_id uuid;
begin
  delete from vault.secrets where name = p_name;
  select vault.create_secret(p_secret, p_name) into v_id;
  return v_id;
end;
$$;

create or replace function admin_delete_vault_secret(p_name text)
returns void
language plpgsql security definer
as $$
begin
  delete from vault.secrets where name = p_name;
end;
$$;
