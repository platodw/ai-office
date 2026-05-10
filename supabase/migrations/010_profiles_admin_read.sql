-- Allow admins to read all profiles.
-- Previously only profiles_select_own existed, which meant admin pages that
-- joined profiles via client_users (e.g. the portal users panel) saw null
-- email/name for every other user.

create policy "profiles_admin_select" on profiles for select using (is_admin());
