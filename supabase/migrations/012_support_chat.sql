-- Support chat: extend existing support tables to handle agent conversations,
-- and add an approvals queue for actions/code changes that need Dan's review.

-- 1. Add `kind` to support_tickets so we can distinguish a casual chat from a
--    formal ticket. Both share the same messages table.
alter table support_tickets
  add column kind text not null default 'chat'
    check (kind in ('ticket', 'chat'));

-- 2. Allow a new status: awaiting_approval. The chat agent flips a ticket into
--    this state when it has a pending action waiting on Dan.
alter table support_tickets
  drop constraint support_tickets_status_check;
alter table support_tickets
  add constraint support_tickets_status_check
    check (status in ('open', 'ai_answered', 'awaiting_approval', 'waiting_on_dan', 'resolved', 'closed'));

create index if not exists support_tickets_kind_idx on support_tickets(kind);

-- 3. support_messages: add cost/model columns + a 'tool' author type for
--    tool_use and tool_result blocks. Existing rows already have author_type
--    in ('client','admin','ai','system'); the new check just expands the set.
alter table support_messages
  drop constraint support_messages_author_type_check;
alter table support_messages
  add constraint support_messages_author_type_check
    check (author_type in ('client', 'admin', 'ai', 'system', 'tool'));

alter table support_messages
  add column input_tokens   integer,
  add column output_tokens  integer,
  add column cost_cents     numeric(10, 4),
  add column model          text,
  add column tool_calls     jsonb,
  add column tool_results   jsonb;

-- 4. Approvals queue. The agent never executes actions directly — it inserts
--    a row here and tells the user "waiting for Dan's approval." Dan reviews
--    in /admin/support/approvals and clicks Approve, which runs the handler.
create table support_approvals (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references support_tickets on delete cascade not null,
  client_id       uuid references clients on delete cascade not null,
  kind            text not null check (kind in ('action', 'code_change')),
  tool_name       text not null,
  title           text not null,
  description     text,
  payload         jsonb not null default '{}'::jsonb,
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected', 'executed', 'failed')),
  decided_by      uuid references auth.users,
  decided_at      timestamptz,
  result          jsonb,
  created_at      timestamptz default now()
);

create index support_approvals_conversation_id_idx on support_approvals(conversation_id);
create index support_approvals_client_id_idx       on support_approvals(client_id);
create index support_approvals_status_idx          on support_approvals(status);

alter table support_approvals enable row level security;

create policy "approvals_admin_all" on support_approvals for all using (is_admin());
create policy "approvals_portal_read" on support_approvals for select
  using (client_id = my_client_id());
