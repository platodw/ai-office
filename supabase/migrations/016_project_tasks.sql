-- Admin-only task tracker for client and internal AI Office work

create table project_tasks (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references clients on delete set null,
  title      text not null,
  notes      text,
  status     text not null default 'todo'
               check (status in ('todo', 'in_progress', 'done')),
  priority   text not null default 'normal'
               check (priority in ('low', 'normal', 'high')),
  due_date   date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table project_tasks enable row level security;
create policy "project_tasks_admin_all" on project_tasks for all using (is_admin());

create trigger project_tasks_updated_at
  before update on project_tasks
  for each row execute function set_updated_at();
