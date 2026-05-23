-- Auto-sync client_api_configs into the Credential Vault.
-- When an API config with a linked key is inserted/updated, mirror it into
-- credential_vault with its own independent encrypted copy of the secret.
-- Fail-safe: sync errors raise a warning but never block the config write.

create or replace function sync_api_config_to_vault(p_config_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  cfg         record;
  v_val       text;
  v_cred_name text;
  v_service   text;
begin
  select * into cfg from client_api_configs where id = p_config_id;
  if not found then return; end if;

  v_cred_name := 'cred_sync_' || cfg.id;

  -- No linked key: drop any previously-synced entry and exit.
  if cfg.vault_secret_name is null then
    delete from credential_vault where vault_secret_name = v_cred_name;
    delete from vault.secrets    where name = v_cred_name;
    return;
  end if;

  select decrypted_secret into v_val
    from vault.decrypted_secrets where name = cfg.vault_secret_name limit 1;
  if v_val is null then return; end if;  -- source secret missing

  v_service := case cfg.provider
                 when 'anthropic' then 'Anthropic'
                 when 'vercel'    then 'Vercel'
                 when 'supabase'  then 'Supabase'
                 else coalesce(nullif(cfg.display_name, ''), 'Other')
               end;

  -- Refresh the independent vault copy.
  delete from vault.secrets where name = v_cred_name;
  perform vault.create_secret(v_val, v_cred_name);

  -- Upsert the metadata row.
  insert into credential_vault (client_id, label, service, vault_secret_name, notes)
  values (cfg.client_id, cfg.display_name, v_service, v_cred_name,
          'Auto-synced from client API configuration (' || cfg.provider || ' / ' || cfg.external_id || ').')
  on conflict (vault_secret_name) do update
    set client_id  = excluded.client_id,
        label      = excluded.label,
        service    = excluded.service,
        notes      = excluded.notes,
        updated_at = now();
end;
$$;

create or replace function trg_sync_api_config_to_vault()
returns trigger
language plpgsql
security definer
as $$
begin
  begin
    perform sync_api_config_to_vault(NEW.id);
  exception when others then
    raise warning 'credential vault sync failed for api config %: %', NEW.id, sqlerrm;
  end;
  return NEW;
end;
$$;

create or replace function trg_unsync_api_config_from_vault()
returns trigger
language plpgsql
security definer
as $$
begin
  begin
    delete from credential_vault where vault_secret_name = 'cred_sync_' || OLD.id;
    delete from vault.secrets    where name              = 'cred_sync_' || OLD.id;
  exception when others then
    raise warning 'credential vault unsync failed for api config %: %', OLD.id, sqlerrm;
  end;
  return OLD;
end;
$$;

drop trigger if exists client_api_configs_vault_sync   on client_api_configs;
drop trigger if exists client_api_configs_vault_unsync on client_api_configs;

create trigger client_api_configs_vault_sync
  after insert or update on client_api_configs
  for each row execute function trg_sync_api_config_to_vault();

create trigger client_api_configs_vault_unsync
  after delete on client_api_configs
  for each row execute function trg_unsync_api_config_from_vault();

-- Reconcile existing data: replace any manual backfill with trigger-managed entries.
do $$
declare r record;
begin
  for r in select vault_secret_name from credential_vault where vault_secret_name like 'cred_backfill_%' loop
    delete from credential_vault where vault_secret_name = r.vault_secret_name;
    delete from vault.secrets    where name = r.vault_secret_name;
  end loop;
  for r in select id from client_api_configs loop
    perform sync_api_config_to_vault(r.id);
  end loop;
end $$;
