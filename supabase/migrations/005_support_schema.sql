-- AI Office — Support schema
-- Knowledge base, help desk tickets, and threaded messages.
-- AI tries to answer from KB first; unresolved tickets route to Telegram or a queue.

-- ── Knowledge base ────────────────────────────────────────────────────────────

create table kb_articles (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  content      text not null,    -- markdown
  category     text,
  tags         text[] default '{}',
  is_published boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index kb_articles_category_idx on kb_articles(category);
create index kb_articles_tags_idx     on kb_articles using gin(tags);

-- Full-text search index on title + content.
create index kb_articles_fts_idx on kb_articles
  using gin(to_tsvector('english', title || ' ' || content));

-- ── Support tickets ───────────────────────────────────────────────────────────

create table support_tickets (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid references clients on delete cascade not null,
  opened_by           uuid references auth.users not null,
  title               text not null,
  status              text not null default 'open'
                        check (status in ('open', 'ai_answered', 'waiting_on_dan', 'resolved', 'closed')),
  priority            text not null default 'normal'
                        check (priority in ('low', 'normal', 'high', 'urgent')),
  kb_article_id       uuid references kb_articles on delete set null,
  telegram_message_id text,     -- set when routed to Dan via Telegram
  resolved_at         timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index support_tickets_client_id_idx on support_tickets(client_id);
create index support_tickets_status_idx    on support_tickets(status);
create index support_tickets_opened_by_idx on support_tickets(opened_by);

-- ── Support messages ──────────────────────────────────────────────────────────

create table support_messages (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    uuid references support_tickets on delete cascade not null,
  author_id    uuid references auth.users,    -- null for AI / system messages
  author_type  text not null
                 check (author_type in ('client', 'admin', 'ai', 'system')),
  content      text not null,
  metadata     jsonb default '{}'::jsonb,     -- AI confidence, KB refs, token usage, etc.
  created_at   timestamptz default now()
);

create index support_messages_ticket_id_idx  on support_messages(ticket_id);
create index support_messages_created_at_idx on support_messages(created_at);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table kb_articles      enable row level security;
alter table support_tickets  enable row level security;
alter table support_messages enable row level security;

-- kb_articles: everyone can read published articles; only admin can write.
create policy "kb_articles_public_read" on kb_articles for select
  using (is_published = true);
create policy "kb_articles_admin_all" on kb_articles for all
  using (is_admin());

-- support_tickets: admin full; portal users manage tickets for their client.
create policy "tickets_admin_all"        on support_tickets for all using (is_admin());
create policy "tickets_portal_read"      on support_tickets for select
  using (client_id = my_client_id());
create policy "tickets_portal_insert"    on support_tickets for insert
  with check (client_id = my_client_id() and opened_by = auth.uid());
create policy "tickets_portal_update"    on support_tickets for update
  using (client_id = my_client_id());

-- support_messages: admin full; portal users read/write on their client's tickets.
create policy "messages_admin_all"     on support_messages for all using (is_admin());
create policy "messages_portal_read"   on support_messages for select
  using (
    ticket_id in (select id from support_tickets where client_id = my_client_id())
  );
create policy "messages_portal_insert" on support_messages for insert
  with check (
    ticket_id in (select id from support_tickets where client_id = my_client_id())
    and author_type = 'client'
    and author_id = auth.uid()
  );

-- ── Updated_at triggers ───────────────────────────────────────────────────────

create trigger kb_articles_updated_at
  before update on kb_articles
  for each row execute function set_updated_at();

create trigger support_tickets_updated_at
  before update on support_tickets
  for each row execute function set_updated_at();
