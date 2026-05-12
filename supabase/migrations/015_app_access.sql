-- Add Supabase project reference to client_apps for cross-project user provisioning
ALTER TABLE client_apps
  ADD COLUMN IF NOT EXISTS supabase_project_ref text,
  ADD COLUMN IF NOT EXISTS supabase_service_key_vault_name text;

-- Track which AI Office portal users have been provisioned to each client app
CREATE TABLE IF NOT EXISTS app_access (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id uuid NOT NULL REFERENCES client_apps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_user_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(app_id, user_id)
);

ALTER TABLE app_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_app_access" ON app_access
  FOR ALL TO authenticated USING (is_admin());
