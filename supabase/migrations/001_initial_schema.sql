-- AI Office — Initial Schema

create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  email text,
  os text check (os in ('mac', 'windows', 'linux')),
  created_at timestamptz default now()
);

create table questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade unique not null,
  responses jsonb not null default '{}'::jsonb,
  submitted_at timestamptz default now()
);

create table setup_guides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade unique not null,
  generated_at timestamptz default now(),
  pdf_url text
);

create table setup_steps (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid references setup_guides on delete cascade not null,
  step_number int not null,
  section text not null,
  title text not null,
  description text,
  why text,
  click_steps text[] default '{}',
  code_blocks jsonb default '[]'::jsonb,
  notes text[] default '{}',
  links jsonb default '[]'::jsonb,
  target_urls text[] default '{}',
  completion_criteria text,
  status text default 'pending' check (status in ('pending', 'in_progress', 'complete', 'skipped')),
  completed_at timestamptz,
  created_at timestamptz default now(),
  unique(guide_id, step_number)
);

create table extension_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade unique not null,
  token uuid default gen_random_uuid() unique not null,
  last_used_at timestamptz,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table questionnaire_responses enable row level security;
alter table setup_guides enable row level security;
alter table setup_steps enable row level security;
alter table extension_tokens enable row level security;

create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

create policy "questionnaire_select_own" on questionnaire_responses for select using (auth.uid() = user_id);
create policy "questionnaire_insert_own" on questionnaire_responses for insert with check (auth.uid() = user_id);
create policy "questionnaire_update_own" on questionnaire_responses for update using (auth.uid() = user_id);

create policy "guides_select_own" on setup_guides for select using (auth.uid() = user_id);
create policy "guides_insert_own" on setup_guides for insert with check (auth.uid() = user_id);

create policy "steps_select_own" on setup_steps for select using (
  guide_id in (select id from setup_guides where user_id = auth.uid())
);
create policy "steps_insert_own" on setup_steps for insert with check (
  guide_id in (select id from setup_guides where user_id = auth.uid())
);
create policy "steps_update_own" on setup_steps for update using (
  guide_id in (select id from setup_guides where user_id = auth.uid())
);

create policy "tokens_select_own" on extension_tokens for select using (auth.uid() = user_id);
create policy "tokens_insert_own" on extension_tokens for insert with check (auth.uid() = user_id);
create policy "tokens_update_own" on extension_tokens for update using (auth.uid() = user_id);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email) values (new.id, new.email);
  insert into extension_tokens (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
