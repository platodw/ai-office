-- Local-Claude investigations of support tickets.
-- When a portal user opens a ticket via chat escalation, a Windows scheduled
-- task on Dan's machine polls for tickets without an investigation row,
-- runs `claude -p` with full MCP access, and POSTs results back here.

create table ticket_investigations (
  id                uuid primary key default gen_random_uuid(),
  ticket_id         uuid references support_tickets on delete cascade not null,
  client_id         uuid references clients on delete cascade not null,
  status            text not null default 'running'
                      check (status in ('running', 'done', 'failed')),
  summary           text,
  suggested_action  text
                      check (suggested_action in (
                        'reply_to_user',
                        'request_info',
                        'fix_code',
                        'config_change',
                        'no_action'
                      )),
  suggested_reply   text,    -- if reply_to_user, ready to post as agent message
  suggested_change  text,    -- markdown describing the fix, PR URL if opened
  pr_url            text,    -- if the local agent opened one
  model             text,
  error             text,
  started_at        timestamptz default now(),
  completed_at      timestamptz
);

create index ticket_investigations_ticket_id_idx on ticket_investigations(ticket_id);
create index ticket_investigations_client_id_idx on ticket_investigations(client_id);
create index ticket_investigations_status_idx    on ticket_investigations(status);

-- Only one in-flight investigation per ticket at a time.
create unique index ticket_investigations_one_running
  on ticket_investigations(ticket_id)
  where status = 'running';

alter table ticket_investigations enable row level security;

create policy "investigations_admin_all"  on ticket_investigations for all using (is_admin());
create policy "investigations_portal_read" on ticket_investigations for select
  using (client_id = my_client_id());
