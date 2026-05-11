-- Per-client knowledge base: rows with a NULL client_id are global (shared
-- across all portal users); rows with a client_id are private to that client.

alter table kb_articles
  add column client_id uuid references clients on delete cascade,
  add column source    text;   -- 'manual' | 'seeded' | etc. for the seed agent

create index kb_articles_client_id_idx on kb_articles(client_id);

-- Refresh the read policy: portal users see global articles AND their own
-- client's articles; admins keep their full-access policy from migration 005.
drop policy if exists "kb_articles_public_read" on kb_articles;
create policy "kb_articles_read" on kb_articles for select
  using (
    is_published = true
    and (client_id is null or client_id = my_client_id())
  );
