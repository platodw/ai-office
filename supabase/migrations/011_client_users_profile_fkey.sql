-- Add a direct FK from client_users.user_id to profiles(id).
-- Both columns already reference auth.users(id), but PostgREST needs an
-- explicit relationship to resolve the `profiles(name, email)` embed used
-- by the admin portal users panel. Without it, the API errors with:
--   "Could not find a relationship between 'client_users' and 'profiles'
--    in the schema cache"

alter table client_users
  add constraint client_users_profile_fkey
  foreign key (user_id) references profiles(id) on delete cascade;

notify pgrst, 'reload schema';
